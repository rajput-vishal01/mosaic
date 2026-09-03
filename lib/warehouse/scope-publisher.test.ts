import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const published: unknown[] = [];
  const transaction = Object.assign(
    vi.fn((_strings: TemplateStringsArray, value: unknown) => {
      published.push(value);
      return Promise.resolve([]);
    }),
    { json: vi.fn(<T>(value: T) => value) },
  );
  const sql = {
    begin: vi.fn((callback: (current: typeof transaction) => Promise<unknown>) => callback(transaction)),
    end: vi.fn(() => Promise.resolve()),
  };
  return { factory: vi.fn(() => sql), published, sql, transaction };
});

vi.mock("postgres", () => ({ default: mocks.factory }));

import { publishWarehouseScopes } from "./scope-publisher";

const configuration = { databaseUrl: "postgresql://unused:unused@127.0.0.1:1/unused", connectTimeoutSeconds: 1 };

describe("warehouse scope publisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.published.length = 0;
  });

  it("rejects malformed mappings before opening a warehouse connection", async () => {
    await expect(publishWarehouseScopes(configuration, [{ accountScopeId: "not-a-uuid", provider: "ga4", externalAccountId: "123", active: true }])).resolves.toEqual({ state: "invalid", message: "The account-scope mapping set is invalid." });
    expect(mocks.factory).not.toHaveBeenCalled();
  });

  it("publishes validated mappings as structured JSON without exposing connection details", async () => {
    const records = [{ accountScopeId: "11111111-1111-4111-8111-111111111111", provider: "ga4" as const, externalAccountId: "123456789", active: true }];
    await expect(publishWarehouseScopes(configuration, records)).resolves.toEqual({ state: "published", count: 1 });
    expect(mocks.published).toEqual([records]);
    expect(mocks.sql.end).toHaveBeenCalledWith({ timeout: 1 });
  });
});
