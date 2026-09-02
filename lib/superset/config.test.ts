import { describe, expect, it } from "vitest";

import { getSupersetConfiguration, isSupersetEmbedConfigured } from "./config";

const environment = {
  SUPERSET_URL: "https://superset.test/",
  SUPERSET_SERVICE_USERNAME: "mosaic-service",
  SUPERSET_SERVICE_PASSWORD: "service-password",
  SUPERSET_GA4_DASHBOARD_ID: "33333333-3333-4333-8333-333333333333",
};

describe("Superset configuration", () => {
  it("distinguishes absent, partial, and ready service configuration", () => {
    expect(getSupersetConfiguration({}).state).toBe("unconfigured");
    expect(getSupersetConfiguration({ SUPERSET_URL: environment.SUPERSET_URL }).state).toBe("incomplete");
    expect(getSupersetConfiguration(environment)).toMatchObject({ state: "ready", configuration: { url: "https://superset.test", requestTimeoutMs: 5_000 } });
  });

  it("requires an explicit embed-hardening acknowledgement", () => {
    expect(isSupersetEmbedConfigured({})).toBe(false);
    expect(isSupersetEmbedConfigured({ SUPERSET_EMBED_READY: "true" })).toBe(true);
  });
});
