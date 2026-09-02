import "server-only";

import createClient from "openapi-fetch";
import { z } from "zod";

import type { AirbyteApiPaths } from "./api-schema";
import type { AirbyteConfiguration } from "./config";

const tokenSchema = z.object({ access_token: z.string().min(1) });
const workspaceSchema = z.object({ workspaceId: z.string().min(1), name: z.string().min(1) });

export type AirbyteProbeResult =
  | { state: "healthy"; checkedAt: string; workspaceName: string }
  | {
      state: "unavailable" | "authentication_failed" | "workspace_not_found" | "invalid_response" | "upstream_error";
      checkedAt: string;
      message: string;
    };

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

export async function probeAirbyte(configuration: AirbyteConfiguration): Promise<AirbyteProbeResult> {
  try {
    const anonymousClient = createAirbyteClient(configuration);
    const health = await anonymousClient.GET("/health");
    if (!health.response.ok) return safeFailure("upstream_error", "Airbyte responded, but its health endpoint is not ready.");

    const tokenResponse = await anonymousClient.POST("/applications/token", {
      body: {
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        "grant-type": "client_credentials",
      },
    });
    if (tokenResponse.response.status === 400 || tokenResponse.response.status === 401 || tokenResponse.response.status === 403) {
      return safeFailure("authentication_failed", "Airbyte rejected the configured application credentials.");
    }
    if (!tokenResponse.response.ok) return safeFailure("upstream_error", "Airbyte could not issue an application token.");

    const token = tokenSchema.safeParse(tokenResponse.data);
    if (!token.success) return safeFailure("invalid_response", "Airbyte returned an unexpected token response.");

    const authenticatedClient = createAirbyteClient(configuration, token.data.access_token);
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
