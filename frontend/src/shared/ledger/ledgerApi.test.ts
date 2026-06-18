import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cachedGet: vi.fn()
}));

vi.mock("../lib/offlineCache", () => ({
  cachedGet: mocks.cachedGet
}));

import type { ApiClient } from "../api/client";
import { fetchLedgerPage } from "./ledgerApi";

function fakeApi(overrides: Partial<ApiClient>): ApiClient {
  return overrides as ApiClient;
}

beforeEach(() => {
  mocks.cachedGet.mockReset();
});

describe("fetchLedgerPage", () => {
  it("uses the offline cache for cacheable first pages", async () => {
    mocks.cachedGet.mockResolvedValueOnce({ results: [{ type: "expense" }], next_offset: 30 });
    const api = fakeApi({ get: vi.fn() });

    const result = await fetchLedgerPage(api, "groups", 7, {
      offset: 0,
      limit: 30,
      search: "",
      cacheable: true
    });

    expect(mocks.cachedGet).toHaveBeenCalledWith(api, "/api/groups/7/ledger/?offset=0&limit=30");
    expect(api.get).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [{ type: "expense" }], nextOffset: 30 });
  });

  it("bypasses the offline cache for searched pages", async () => {
    const get = vi.fn().mockResolvedValueOnce({ results: [], next_offset: null });
    const api = fakeApi({ get });

    await fetchLedgerPage(api, "friends", 3, {
      offset: 30,
      limit: 30,
      search: "coffee & cake",
      cacheable: false
    });

    expect(get).toHaveBeenCalledWith("/api/friends/3/ledger/?offset=30&limit=30&search=coffee%20%26%20cake");
  });
});
