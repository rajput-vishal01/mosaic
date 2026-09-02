import { describe, expect, it } from "vitest";

import { ga4SetupSchema } from "./ga4-schema";

describe("GA4 setup input", () => {
  it("normalizes comma and newline separated property IDs", () => {
    expect(ga4SetupSchema.parse({ label: "Main analytics", propertyIds: "123456789, 987654321\n123456789", startDate: "2025-01-01" })).toEqual({
      label: "Main analytics",
      propertyIds: ["123456789", "987654321"],
      startDate: "2025-01-01",
    });
  });

  it("rejects non-numeric property identifiers", () => {
    expect(ga4SetupSchema.safeParse({ label: "Main analytics", propertyIds: "G-ABC123", startDate: "" }).success).toBe(false);
  });
});
