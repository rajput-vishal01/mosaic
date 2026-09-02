import "server-only";

import { z } from "zod";

const schema = z.object({
  url: z.url().transform((value) => value.replace(/\/$/, "")),
  username: z.string().min(1),
  password: z.string().min(1),
  ga4DashboardId: z.uuid(),
  requestTimeoutMs: z.coerce.number().int().min(1_000).max(30_000).default(5_000),
});

export type SupersetConfiguration = z.infer<typeof schema>;
type Environment = Readonly<Record<string, string | undefined>>;

const required = ["SUPERSET_URL", "SUPERSET_SERVICE_USERNAME", "SUPERSET_SERVICE_PASSWORD", "SUPERSET_GA4_DASHBOARD_ID"] as const;

export function getSupersetConfiguration(environment: Environment = process.env) {
  const present = required.filter((key) => Boolean(environment[key]?.trim())).length;
  const missing = required.filter((key) => !environment[key]?.trim());
  if (present === 0) return { state: "unconfigured", missing: [...required] } as const;
  if (missing.length > 0) return { state: "incomplete", missing } as const;

  const parsed = schema.safeParse({
    url: environment.SUPERSET_URL,
    username: environment.SUPERSET_SERVICE_USERNAME,
    password: environment.SUPERSET_SERVICE_PASSWORD,
    ga4DashboardId: environment.SUPERSET_GA4_DASHBOARD_ID,
    requestTimeoutMs: environment.SUPERSET_REQUEST_TIMEOUT_MS,
  });
  return parsed.success
    ? { state: "ready", configuration: parsed.data } as const
    : { state: "invalid", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) } as const;
}

export function isSupersetEmbedConfigured(environment: Environment = process.env) {
  return environment.SUPERSET_EMBED_READY === "true";
}
