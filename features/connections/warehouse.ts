import "server-only";

import { eq, ne } from "drizzle-orm";

import { fixtureAuthorizationLabel } from "@/features/account-grants/fixtures";
import { db } from "@/lib/db";
import { providerAuthorization, sourceAccount } from "@/lib/db/schema";
import { publishWarehouseScopes } from "@/lib/warehouse/scope-publisher";
import type { WarehouseScopeConfiguration } from "@/lib/warehouse/config";

export async function publishCanonicalWarehouseScopes(configuration: WarehouseScopeConfiguration) {
  const accounts = await db
    .select({
      accountScopeId: sourceAccount.accountScopeId,
      provider: providerAuthorization.provider,
      externalAccountId: sourceAccount.externalAccountId,
      authorizationStatus: providerAuthorization.status,
      airbyteSourceId: providerAuthorization.airbyteSourceId,
      airbyteConnectionId: providerAuthorization.airbyteConnectionId,
    })
    .from(sourceAccount)
    .innerJoin(providerAuthorization, eq(providerAuthorization.id, sourceAccount.authorizationId))
    .where(ne(providerAuthorization.label, fixtureAuthorizationLabel));

  return publishWarehouseScopes(configuration, accounts.map((account) => ({
    accountScopeId: account.accountScopeId,
    provider: account.provider,
    externalAccountId: account.externalAccountId,
    active: account.authorizationStatus === "active" && Boolean(account.airbyteSourceId) && Boolean(account.airbyteConnectionId),
  })));
}
