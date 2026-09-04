import postgres from "postgres";
import { z } from "zod";

import { Ga4TransformError, transformGa4DirectLoad } from "./ga4-transform";

const configurationSchema = z.object({
  databaseUrl: z.string().url().refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://")),
  connectTimeoutSeconds: z.coerce.number().int().min(1).max(30).default(5),
});

async function main() {
  const configuration = configurationSchema.safeParse({
    databaseUrl: process.env.WAREHOUSE_TRANSFORM_DATABASE_URL,
    connectTimeoutSeconds: process.env.WAREHOUSE_TRANSFORM_CONNECT_TIMEOUT_SECONDS,
  });
  if (!configuration.success) throw new Ga4TransformError("The warehouse transform runner is not configured correctly.");

  const sql = postgres(configuration.data.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: configuration.data.connectTimeoutSeconds,
  });

  try {
    const results = await transformGa4DirectLoad(sql);
    const rowsLoaded = results.reduce((total, result) => total + result.rowsLoaded, 0);
    process.stdout.write(`GA4 transform completed: ${results.length} table(s), ${rowsLoaded} row(s) loaded.\n`);
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Ga4TransformError ? error.message : "The GA4 transform failed safely.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
