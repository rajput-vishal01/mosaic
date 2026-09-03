import "server-only";

import { z } from "zod";

const configurationSchema = z.object({
  apiUrl: z.url().transform((value) => value.replace(/\/$/, "")),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  workspaceId: z.uuid(),
  destinationId: z.uuid(),
  requestTimeoutMs: z.coerce.number().int().min(1_000).max(30_000).default(5_000),
  syncFrequencyHours: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(8), z.literal(12), z.literal(24)])).default(6),
});

export type AirbyteConfiguration = z.infer<typeof configurationSchema>;

const requiredEnvironmentKeys = [
  "AIRBYTE_API_URL",
  "AIRBYTE_CLIENT_ID",
  "AIRBYTE_CLIENT_SECRET",
  "AIRBYTE_WORKSPACE_ID",
  "AIRBYTE_DESTINATION_ID",
] as const;

type AirbyteConfigurationStatus =
  | { state: "unconfigured"; missing: string[] }
  | { state: "incomplete"; missing: string[] }
  | { state: "invalid"; issues: string[] }
  | { state: "ready"; configuration: AirbyteConfiguration };

type Environment = Readonly<Record<string, string | undefined>>;

export function getAirbyteConfiguration(environment: Environment = process.env): AirbyteConfigurationStatus {
  const presentCount = requiredEnvironmentKeys.filter((key) => Boolean(environment[key]?.trim())).length;
  const missing = requiredEnvironmentKeys.filter((key) => !environment[key]?.trim());

  if (presentCount === 0) return { state: "unconfigured", missing: [...requiredEnvironmentKeys] };
  if (missing.length > 0) return { state: "incomplete", missing };

  const parsed = configurationSchema.safeParse({
    apiUrl: environment.AIRBYTE_API_URL,
    clientId: environment.AIRBYTE_CLIENT_ID,
    clientSecret: environment.AIRBYTE_CLIENT_SECRET,
    workspaceId: environment.AIRBYTE_WORKSPACE_ID,
    destinationId: environment.AIRBYTE_DESTINATION_ID,
    requestTimeoutMs: environment.AIRBYTE_REQUEST_TIMEOUT_MS,
    syncFrequencyHours: environment.AIRBYTE_SYNC_FREQUENCY_HOURS,
  });

  if (!parsed.success) {
    return {
      state: "invalid",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  return { state: "ready", configuration: parsed.data };
}

export function getSafeAirbyteConfigurationStatus(environment: Environment = process.env) {
  const status = getAirbyteConfiguration(environment);
  if (status.state === "ready") {
    return {
      state: status.state,
      apiUrl: new URL(status.configuration.apiUrl).origin,
      workspaceConfigured: true,
      destinationConfigured: true,
      syncFrequencyHours: status.configuration.syncFrequencyHours,
    } as const;
  }
  return status;
}

export function isGa4OauthConfigured(environment: Environment = process.env) {
  return environment.AIRBYTE_GA4_OAUTH_READY === "true";
}
