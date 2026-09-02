import "server-only";

import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerAuthorization, sourceAccount } from "@/lib/db/schema";

export async function listConnectionSummaries() {
  return db
    .select({
      id: providerAuthorization.id,
      provider: providerAuthorization.provider,
      label: providerAuthorization.label,
      status: providerAuthorization.status,
      externalReference: providerAuthorization.externalReference,
      accountCount: count(sourceAccount.id),
      updatedAt: providerAuthorization.updatedAt,
    })
    .from(providerAuthorization)
    .leftJoin(sourceAccount, eq(sourceAccount.authorizationId, providerAuthorization.id))
    .groupBy(providerAuthorization.id)
    .orderBy(providerAuthorization.provider, providerAuthorization.label);
}
