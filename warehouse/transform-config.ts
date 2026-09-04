import { z } from "zod";

const configurationSchema = z.object({
  databaseUrl: z.string().url().refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://")),
  connectTimeoutSeconds: z.coerce.number().int().min(1).max(30).default(5),
});

export function getWarehouseTransformConfiguration(environment: Readonly<Record<string, string | undefined>> = process.env) {
  const parsed = configurationSchema.safeParse({
    databaseUrl: environment.WAREHOUSE_TRANSFORM_DATABASE_URL,
    connectTimeoutSeconds: environment.WAREHOUSE_TRANSFORM_CONNECT_TIMEOUT_SECONDS,
  });
  return parsed.success
    ? { state: "ready" as const, configuration: parsed.data }
    : { state: "invalid" as const };
}
