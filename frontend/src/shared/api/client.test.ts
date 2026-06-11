import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};
const platform = vi.hoisted(() => ({ OS: "web" as string }));
const handleDemoRequest = vi.hoisted(() => vi.fn());
const persistDemoMode = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    async getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    async setItem(key: string, value: string) {
      store[key] = value;
    },
    async removeItem(key: string) {
      delete store[key];
    }
  }
}));
vi.mock("../demo/demoBackend", () => ({ handleDemoRequest }));
vi.mock("../demo/demoMode", () => ({ persistDemoMode }));

import { ApiClient, ApiError, tokenStorage } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  platform.OS = "web";
  handleDemoRequest.mockReset();
  persistDemoMode.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiClient.request", () => {
  it("performs a GET and parses JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: "world" }));
    const api = new ApiClient();
    const result = await api.get<{ hello: string }>("/api/x/");
    expect(result).toEqual({ hello: "world" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/x/");
    expect((init.headers as Headers).get("Accept")).toBe("application/json");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("serializes POST/PATCH bodies and sets the method", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ ok: true }));
    const api = new ApiClient();
    await api.post("/api/x/", { a: 1 });
    await api.patch("/api/x/", { b: 2 });
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ a: 1 }));
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
  });

  it("omits the body when none is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const api = new ApiClient();
    await api.post("/api/x/");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = new ApiClient();
    expect(await api.delete("/api/x/")).toBeUndefined();
  });

  it("attaches the bearer token when authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const api = new ApiClient();
    api.setTokens({ access: "abc", refresh: "r" });
    await api.get("/api/x/");
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Authorization")).toBe("Bearer abc");
  });

  it("does not set Content-Type for FormData uploads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const api = new ApiClient();
    await api.upload("/api/x/", new FormData());
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Content-Type")).toBeNull();
  });

  it("throws an offline ApiError when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const api = new ApiClient();
    await expect(api.get("/api/x/")).rejects.toMatchObject({ offline: true });
  });

  it("throws ApiError with parsed data on error responses", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "nope" }, 400));
    const api = new ApiClient();
    await expect(api.get("/api/x/")).rejects.toMatchObject({
      status: 400,
      data: { detail: "nope" }
    });
  });

  it("throws ApiError without data when error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>oops</html>", { status: 500, headers: { "content-type": "text/html" } })
    );
    const api = new ApiClient();
    const error = (await api.get("/api/x/").catch((e) => e)) as ApiError;
    expect(error.status).toBe(500);
    expect(error.data).toBeUndefined();
    expect(error.message).toContain("Unexpected HTML response");
  });

  it("throws ApiError when a 200 response is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("plain text", { status: 200, headers: { "content-type": "text/plain" } })
    );
    const api = new ApiClient();
    await expect(api.get("/api/x/")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ApiClient token refresh", () => {
  it("refreshes on 401 and retries the original request", async () => {
    const api = new ApiClient();
    api.setTokens({ access: "old", refresh: "r" });
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(jsonResponse({ access: "new", refresh: "r2" })) // refresh
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // retry

    const result = await api.get<{ ok: boolean }>("/api/x/");

    expect(result).toEqual({ ok: true });
    expect(api.getAccessToken()).toBe("new");
    // refresh endpoint was hit
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/token/refresh/");
    // retry carried the new token
    expect((fetchMock.mock.calls[2][1].headers as Headers).get("Authorization")).toBe("Bearer new");
  });

  it("clears tokens and throws when refresh is rejected", async () => {
    const api = new ApiClient();
    const onChange = vi.fn();
    api.setTokenChangeHandler(onChange);
    api.setTokens({ access: "old", refresh: "r" });
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }));

    await expect(api.get("/api/x/")).rejects.toMatchObject({ message: "Authentication expired" });
    expect(api.getAccessToken()).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(store["splex.tokens"]).toBeUndefined();
  });

  it("surfaces an offline error when the refresh call itself fails", async () => {
    const api = new ApiClient();
    api.setTokens({ access: "old", refresh: "r" });
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }))
      .mockRejectedValueOnce(new Error("net"));
    await expect(api.get("/api/x/")).rejects.toMatchObject({ offline: true });
  });

  it("does not retry a second time if the retried request also 401s", async () => {
    const api = new ApiClient();
    api.setTokens({ access: "old", refresh: "r" });
    fetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(jsonResponse({ access: "new" })) // refresh
      .mockResolvedValueOnce(jsonResponse({ detail: "still" }, 401)); // retry still 401 → error
    await expect(api.get("/api/x/")).rejects.toMatchObject({ status: 401 });
  });
});

describe("ApiClient demo mode", () => {
  it("routes requests to the demo backend and persists the flag", async () => {
    handleDemoRequest.mockResolvedValue({ demo: true });
    const api = new ApiClient();
    await api.setDemoMode(true);
    expect(persistDemoMode).toHaveBeenCalledWith(true);
    expect(api.isDemoMode()).toBe(true);

    const result = await api.get<{ demo: boolean }>("/api/x/");
    expect(result).toEqual({ demo: true });
    expect(handleDemoRequest).toHaveBeenCalledWith("GET", "/api/x/");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetchBinary refuses to run in demo mode", async () => {
    const api = new ApiClient();
    await api.setDemoMode(true);
    await expect(api.fetchBinary("/api/receipts/1/")).rejects.toMatchObject({ status: 400 });
  });
});

describe("ApiClient.fetchBinary", () => {
  it("returns the raw response on success", async () => {
    const api = new ApiClient();
    api.setTokens({ access: "abc", refresh: "r" });
    const binary = new Response("filedata", { status: 200 });
    fetchMock.mockResolvedValueOnce(binary);
    const response = await api.fetchBinary("/api/receipts/1/");
    expect(await response.text()).toBe("filedata");
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Authorization")).toBe("Bearer abc");
  });

  it("refreshes once on 401 then retries", async () => {
    const api = new ApiClient();
    api.setTokens({ access: "old", refresh: "r" });
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ access: "new" })) // refresh
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const response = await api.fetchBinary("/api/receipts/1/");
    expect(response.status).toBe(200);
  });

  it("throws an ApiError on a non-ok response", async () => {
    const api = new ApiClient();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(api.fetchBinary("/api/receipts/1/")).rejects.toMatchObject({ status: 404 });
  });

  it("throws an offline error when the network is down", async () => {
    const api = new ApiClient();
    fetchMock.mockRejectedValueOnce(new Error("net"));
    await expect(api.fetchBinary("/api/receipts/1/")).rejects.toMatchObject({ offline: true });
  });
});

describe("native base URL handling", () => {
  it("reads, normalizes and caches the stored base URL on native", async () => {
    platform.OS = "android";
    store["splex.apiBaseUrl"] = "https://api.example.com//";
    const api = new ApiClient();
    fetchMock.mockResolvedValue(jsonResponse({}));
    await api.get("/api/x/");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/x/");
  });

  it("setBaseUrl normalizes and persists the value on native", async () => {
    platform.OS = "android";
    const api = new ApiClient();
    await api.setBaseUrl("https://host.example.com/");
    expect(store["splex.apiBaseUrl"]).toBe("https://host.example.com");
  });

  it("setBaseUrl is a no-op on web", async () => {
    platform.OS = "web";
    const api = new ApiClient();
    await api.setBaseUrl("https://ignored.example.com");
    expect(store["splex.apiBaseUrl"]).toBeUndefined();
  });
});

describe("tokenStorage", () => {
  it("round-trips tokens and clears them on null", async () => {
    expect(await tokenStorage.get()).toBeNull();
    await tokenStorage.set({ access: "a", refresh: "b" });
    expect(await tokenStorage.get()).toEqual({ access: "a", refresh: "b" });
    await tokenStorage.set(null);
    expect(await tokenStorage.get()).toBeNull();
  });
});
