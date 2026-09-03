import { describe, expect, it } from "vitest";

import { getAirbyteConfiguration, getSafeAirbyteConfigurationStatus, isGa4OauthConfigured } from "./config";

const validEnvironment = {
  AIRBYTE_API_URL: "http://airbyte.test/v1/",
  AIRBYTE_CLIENT_ID: "client-id",
  AIRBYTE_CLIENT_SECRET: "client-secret",
  AIRBYTE_WORKSPACE_ID: "11111111-1111-4111-8111-111111111111",
  AIRBYTE_DESTINATION_ID: "22222222-2222-4222-8222-222222222222",
};

describe("Airbyte configuration", () => {
  it("distinguishes an untouched environment from a partial setup", () => {
    expect(getAirbyteConfiguration({}).state).toBe("unconfigured");
    expect(getAirbyteConfiguration({ AIRBYTE_API_URL: validEnvironment.AIRBYTE_API_URL })).toMatchObject({
      state: "incomplete",
      missing: ["AIRBYTE_CLIENT_ID", "AIRBYTE_CLIENT_SECRET", "AIRBYTE_WORKSPACE_ID", "AIRBYTE_DESTINATION_ID"],
    });
  });

  it("normalizes a complete configuration and applies the timeout default", () => {
    expect(getAirbyteConfiguration(validEnvironment)).toEqual({
      state: "ready",
      configuration: {
        apiUrl: "http://airbyte.test/v1",
        clientId: "client-id",
        clientSecret: "client-secret",
        workspaceId: validEnvironment.AIRBYTE_WORKSPACE_ID,
        destinationId: validEnvironment.AIRBYTE_DESTINATION_ID,
        requestTimeoutMs: 5_000,
        syncFrequencyHours: 6,
      },
    });
  });

  it("accepts only supported server-owned synchronization intervals", () => {
    expect(getAirbyteConfiguration({ ...validEnvironment, AIRBYTE_SYNC_FREQUENCY_HOURS: "12" })).toMatchObject({ state: "ready", configuration: { syncFrequencyHours: 12 } });
    expect(getAirbyteConfiguration({ ...validEnvironment, AIRBYTE_SYNC_FREQUENCY_HOURS: "0" }).state).toBe("invalid");
    expect(getAirbyteConfiguration({ ...validEnvironment, AIRBYTE_SYNC_FREQUENCY_HOURS: "5" }).state).toBe("invalid");
  });

  it("never exposes credentials through the safe status", () => {
    const serialized = JSON.stringify(getSafeAirbyteConfigurationStatus(validEnvironment));
    expect(serialized).not.toContain("client-secret");
    expect(serialized).not.toContain("client-id");
    expect(serialized).not.toContain(validEnvironment.AIRBYTE_WORKSPACE_ID);
  });

  it("requires an explicit acknowledgement that the GA4 OAuth override exists", () => {
    expect(isGa4OauthConfigured({})).toBe(false);
    expect(isGa4OauthConfigured({ AIRBYTE_GA4_OAUTH_READY: "true" })).toBe(true);
  });
});
