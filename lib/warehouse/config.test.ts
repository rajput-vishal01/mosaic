import { describe, expect, it } from "vitest";

import { getSafeWarehouseScopeStatus, getWarehouseScopeConfiguration } from "./config";

describe("warehouse scope configuration", () => {
  it("supports an intentionally unconfigured environment", () => {
    expect(getWarehouseScopeConfiguration({})).toEqual({ state: "unconfigured" });
  });

  it("accepts PostgreSQL URLs and applies a bounded timeout", () => {
    expect(getWarehouseScopeConfiguration({ WAREHOUSE_SCOPE_DATABASE_URL: "postgresql://scope:secret@warehouse.test/mosaic" })).toMatchObject({ state: "ready", configuration: { connectTimeoutSeconds: 5 } });
    expect(getWarehouseScopeConfiguration({ WAREHOUSE_SCOPE_DATABASE_URL: "https://warehouse.test/mosaic" }).state).toBe("invalid");
    expect(getWarehouseScopeConfiguration({ WAREHOUSE_SCOPE_DATABASE_URL: "postgresql://scope:secret@warehouse.test/mosaic", WAREHOUSE_SCOPE_CONNECT_TIMEOUT_SECONDS: "31" }).state).toBe("invalid");
  });

  it("never exposes the credential-bearing URL through safe status", () => {
    expect(JSON.stringify(getSafeWarehouseScopeStatus({ WAREHOUSE_SCOPE_DATABASE_URL: "postgresql://scope:secret@warehouse.test/mosaic" }))).not.toContain("secret");
  });
});
