import "server-only";

import { z } from "zod";

const schema = z.object({
  databaseUrl: z.url().refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), "Use a PostgreSQL connection URL."),
  connectTimeoutSeconds: z.coerce.number().int().min(1).max(30).default(5),
});

export type WarehouseScopeConfiguration = z.infer<typeof schema>;
type Environment = Readonly<Record<string, string | undefined>>;

export function getWarehouseScopeConfiguration(environment: Environment = process.env) {
  if (!environment.WAREHOUSE_SCOPE_DATABASE_URL?.trim()) return { state: "unconfigured" } as const;
  const parsed = schema.safeParse({ databaseUrl: environment.WAREHOUSE_SCOPE_DATABASE_URL, connectTimeoutSeconds: environment.WAREHOUSE_SCOPE_CONNECT_TIMEOUT_SECONDS });
  return parsed.success
    ? { state: "ready", configuration: parsed.data } as const
    : { state: "invalid", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) } as const;
}

export function getSafeWarehouseScopeStatus(environment: Environment = process.env) {
  const status = getWarehouseScopeConfiguration(environment);
  return status.state === "ready" ? { state: "ready" } as const : status;
}
