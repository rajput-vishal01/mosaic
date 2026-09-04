import { describe, expect, it } from "vitest";

import { getWarehouseTransformConfiguration } from "./transform-config";

describe("warehouse transform configuration", () => {
  it("accepts only bounded PostgreSQL runtime configuration", () => {
    expect(getWarehouseTransformConfiguration({
      WAREHOUSE_TRANSFORM_DATABASE_URL: "postgresql://runner:secret@warehouse.test/mosaic",
    })).toMatchObject({ state: "ready", configuration: { connectTimeoutSeconds: 5 } });
    expect(getWarehouseTransformConfiguration({ WAREHOUSE_TRANSFORM_DATABASE_URL: "https://warehouse.test/mosaic" }).state).toBe("invalid");
    expect(getWarehouseTransformConfiguration({
      WAREHOUSE_TRANSFORM_DATABASE_URL: "postgresql://runner:secret@warehouse.test/mosaic",
      WAREHOUSE_TRANSFORM_CONNECT_TIMEOUT_SECONDS: "31",
    }).state).toBe("invalid");
  });

  it("does not return a credential-bearing URL for invalid configuration", () => {
    expect(JSON.stringify(getWarehouseTransformConfiguration({
      WAREHOUSE_TRANSFORM_DATABASE_URL: "postgresql://runner:secret@warehouse.test/mosaic",
      WAREHOUSE_TRANSFORM_CONNECT_TIMEOUT_SECONDS: "invalid",
    }))).not.toContain("secret");
  });
});
