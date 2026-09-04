import postgres from "postgres";

import { refreshLinkedAirbyteSnapshots } from "@/features/connections/commands";
import { getAirbyteSourcePrefix } from "@/lib/airbyte/client";
import { getAirbyteConfiguration } from "@/lib/airbyte/config";
import { closeDatabaseConnection } from "@/lib/db/client";
import { Ga4TransformError, transformGa4DirectLoad } from "@/warehouse/ga4-transform";
import { getWarehouseTransformConfiguration } from "@/warehouse/transform-config";

class ReconcileError extends Error {}

async function main() {
  const airbyte = getAirbyteConfiguration();
  const warehouse = getWarehouseTransformConfiguration();
  if (airbyte.state !== "ready" || warehouse.state !== "ready") {
    throw new ReconcileError("The synchronization reconciler is not configured correctly.");
  }

  const transformSql = postgres(warehouse.configuration.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: warehouse.configuration.connectTimeoutSeconds,
  });

  try {
    const syncs = await refreshLinkedAirbyteSnapshots(airbyte.configuration);
    const sourcePrefixes = syncs.transformEligibleSourceIds.map(getAirbyteSourcePrefix);
    const transformed = await transformGa4DirectLoad(transformSql, { sourcePrefixes });
    const rowsLoaded = transformed.reduce((total, result) => total + result.rowsLoaded, 0);

    process.stdout.write(
      `Synchronization reconciliation completed: ${syncs.updated}/${syncs.linked} connection(s) observed, ${syncs.runsObserved} run(s) retained, ${rowsLoaded} row(s) loaded.\n`,
    );
    if (syncs.unavailable > 0) throw new ReconcileError("One or more Airbyte connections could not be reconciled.");
  } finally {
    await Promise.all([transformSql.end(), closeDatabaseConnection()]);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof ReconcileError || error instanceof Ga4TransformError
    ? error.message
    : "Synchronization reconciliation failed safely.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
