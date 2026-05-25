import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("react-native", () => ({
  Platform: { OS: "web" }
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => (storage.has(key) ? storage.get(key)! : null)),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    })
  }
}));

import { ApiClient, ApiError } from "../api/client";
import { cachedGet, prefetchPaths, readCachedResponse } from "./offlineCache";

function fakeApi(overrides: Partial<ApiClient>): ApiClient {
  return overrides as ApiClient;
}

beforeEach(() => {
  storage.clear();
});

describe("cachedGet", () => {
  it("caches successful responses and returns them on later offline failures", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ value: 1 })
      .mockRejectedValueOnce(new ApiError("offline", { offline: true }));
    const api = fakeApi({ get });

    const first = await cachedGet<{ value: number }>(api, "/api/things/");
    expect(first).toEqual({ value: 1 });

    const second = await cachedGet<{ value: number }>(api, "/api/things/");
    expect(second).toEqual({ value: 1 });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-offline errors so auth/server failures are not masked by stale data", async () => {
    storage.set("splex.cache.http./api/things/", JSON.stringify({ stale: true }));
    const get = vi.fn().mockRejectedValue(new ApiError("server", { status: 500 }));
    const api = fakeApi({ get });

    await expect(cachedGet(api, "/api/things/")).rejects.toBeInstanceOf(ApiError);
  });

  it("rethrows the offline error when nothing is cached yet", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError("offline", { offline: true }));
    const api = fakeApi({ get });

    await expect(cachedGet(api, "/api/things/")).rejects.toMatchObject({ offline: true });
  });

  it("uses distinct cache entries per path so different resources don't collide", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ kind: "group" })
      .mockResolvedValueOnce({ kind: "friend" });
    const api = fakeApi({ get });

    await cachedGet(api, "/api/groups/1/");
    await cachedGet(api, "/api/friends/1/");

    expect(await readCachedResponse("/api/groups/1/")).toEqual({ kind: "group" });
    expect(await readCachedResponse("/api/friends/1/")).toEqual({ kind: "friend" });
  });
});

describe("readCachedResponse", () => {
  it("returns null when no value is cached", async () => {
    expect(await readCachedResponse("/api/missing/")).toBeNull();
  });
});

describe("prefetchPaths", () => {
  it("populates the cache for each path and swallows failures", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockRejectedValueOnce(new ApiError("offline", { offline: true }));
    const api = fakeApi({ get });

    await prefetchPaths(api, ["/api/groups/", "/api/friends/"]);

    expect(await readCachedResponse("/api/groups/")).toEqual([{ id: 1 }]);
    expect(await readCachedResponse("/api/friends/")).toBeNull();
  });
});
