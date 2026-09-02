import "server-only";

import createClient from "openapi-fetch";
import { z } from "zod";

import type { AirbyteApiPaths } from "./api-schema";
import type { AirbyteConfiguration } from "./config";

const tokenSchema = z.object({ access_token: z.string().min(1) });
const workspaceSchema = z.object({ workspaceId: z.string().min(1), name: z.string().min(1) });
const jobSchema = z.object({
  jobId: z.number().int().nonnegative(),
  status: z.enum(["pending", "queued", "running", "incomplete", "failed", "succeeded", "cancelled"]),
  jobType: z.enum(["sync", "reset", "refresh", "clear"]),
  startTime: z.string().min(1),
  connectionId: z.string().min(1),
  lastUpdatedAt: z.string().min(1).optional(),
  rowsSynced: z.number().int().nonnegative().optional(),
});
const jobsSchema = z.object({ data: z.array(jobSchema) });

export type AirbyteProbeResult =
  | { state: "healthy"; checkedAt: string; workspaceName: string }
  | {
      state: "unavailable" | "authentication_failed" | "workspace_not_found" | "invalid_response" | "upstream_error";
      checkedAt: string;
      message: string;
    };

export type AirbyteLatestSyncResult =
  | { state: "empty" }
  | {
      state: "found";
      snapshot: {
        jobId: string;
        status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
        recordsSynced: number | null;
        startedAt: Date;
        completedAt: Date | null;
        failureType: "unknown" | null;
      };
    }
  | { state: "authentication_failed" | "invalid_response" | "upstream_error" | "unavailable"; message: string };

function safeFailure(state: Exclude<AirbyteProbeResult["state"], "healthy">, message: string): AirbyteProbeResult {
  return { state, checkedAt: new Date().toISOString(), message };
}

function createAirbyteClient(configuration: AirbyteConfiguration, accessToken?: string) {
  return createClient<AirbyteApiPaths>({
    baseUrl: configuration.apiUrl,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    fetch: async (request) => fetch(request, { signal: AbortSignal.timeout(configuration.requestTimeoutMs) }),
  });
}

async function requestAccessToken(configuration: AirbyteConfiguration) {
  const client = createAirbyteClient(configuration);
  const response = await client.POST("/applications/token", {
    body: { client_id: configuration.clientId, client_secret: configuration.clientSecret, "grant-type": "client_credentials" },
  });
  if (response.response.status === 400 || response.response.status === 401 || response.response.status === 403) {
    return { state: "authentication_failed", message: "Airbyte rejected the configured application credentials." } as const;
  }
  if (!response.response.ok) return { state: "upstream_error", message: "Airbyte could not issue an application token." } as const;
  const token = tokenSchema.safeParse(response.data);
  if (!token.success) return { state: "invalid_response", message: "Airbyte returned an unexpected token response." } as const;
  return { state: "authenticated", accessToken: token.data.access_token } as const;
}

export async function probeAirbyte(configuration: AirbyteConfiguration): Promise<AirbyteProbeResult> {
  try {
    const anonymousClient = createAirbyteClient(configuration);
    const health = await anonymousClient.GET("/health");
    if (!health.response.ok) return safeFailure("upstream_error", "Airbyte responded, but its health endpoint is not ready.");

    const token = await requestAccessToken(configuration);
    if (token.state !== "authenticated") return safeFailure(token.state, token.message);

    const authenticatedClient = createAirbyteClient(configuration, token.accessToken);
    const workspaceResponse = await authenticatedClient.GET("/workspaces/{workspaceId}", {
      params: { path: { workspaceId: configuration.workspaceId } },
    });
    if (workspaceResponse.response.status === 403) {
      return safeFailure("authentication_failed", "The Airbyte application cannot access the configured workspace.");
    }
    if (workspaceResponse.response.status === 404) {
      return safeFailure("workspace_not_found", "The configured Airbyte workspace was not found.");
    }
    if (!workspaceResponse.response.ok) return safeFailure("upstream_error", "Airbyte could not read the configured workspace.");

    const workspace = workspaceSchema.safeParse(workspaceResponse.data);
    if (!workspace.success || workspace.data.workspaceId !== configuration.workspaceId) {
      return safeFailure("invalid_response", "Airbyte returned an unexpected workspace response.");
    }

    return { state: "healthy", checkedAt: new Date().toISOString(), workspaceName: workspace.data.name };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return safeFailure("unavailable", timedOut ? "Airbyte did not respond before the request timed out." : "Mosaic could not reach Airbyte.");
  }
}

const syncStatusMap = {
  pending: "pending",
  queued: "pending",
  running: "running",
  incomplete: "failed",
  failed: "failed",
  succeeded: "succeeded",
  cancelled: "cancelled",
} as const;

function parseAirbyteDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getLatestAirbyteSync(configuration: AirbyteConfiguration, connectionId: string): Promise<AirbyteLatestSyncResult> {
  try {
    const token = await requestAccessToken(configuration);
    if (token.state !== "authenticated") return token;

    const client = createAirbyteClient(configuration, token.accessToken);
    const response = await client.GET("/jobs", {
      params: { query: { connectionId, jobType: "sync", limit: 1, orderBy: "updatedAt|DESC" } },
    });
    if (response.response.status === 403) return { state: "authentication_failed", message: "The Airbyte application cannot read synchronization jobs." };
    if (!response.response.ok) return { state: "upstream_error", message: "Airbyte could not read synchronization jobs." };

    const parsed = jobsSchema.safeParse(response.data);
    if (!parsed.success) return { state: "invalid_response", message: "Airbyte returned an unexpected job response." };
    const job = parsed.data.data[0];
    if (!job) return { state: "empty" };

    const startedAt = parseAirbyteDate(job.startTime);
    if (job.connectionId !== connectionId || job.jobType !== "sync" || !startedAt) {
      return { state: "invalid_response", message: "Airbyte returned a job outside the requested connection scope." };
    }

    const status = syncStatusMap[job.status];
    const terminal = status === "succeeded" || status === "failed" || status === "cancelled";
    const completedAt = terminal ? parseAirbyteDate(job.lastUpdatedAt) : null;
    if (terminal && !completedAt) return { state: "invalid_response", message: "Airbyte returned an incomplete terminal job response." };

    return {
      state: "found",
      snapshot: {
        jobId: String(job.jobId),
        status,
        recordsSynced: job.rowsSynced ?? null,
        startedAt,
        completedAt,
        failureType: status === "failed" ? "unknown" : null,
      },
    };
  } catch {
    return { state: "unavailable", message: "Mosaic could not reach Airbyte." };
  }
}
