import postgres from "postgres";

import { Ga4TransformError, transformGa4DirectLoad } from "./ga4-transform";
import { getWarehouseTransformConfiguration } from "./transform-config";

async function main() {
  const configuration = getWarehouseTransformConfiguration();
  if (configuration.state !== "ready") throw new Ga4TransformError("The warehouse transform runner is not configured correctly.");

  const sql = postgres(configuration.configuration.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: configuration.configuration.connectTimeoutSeconds,
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
