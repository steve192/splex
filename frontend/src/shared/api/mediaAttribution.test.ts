import { describe, expect, it, vi } from "vitest";

import { fetchMediaAttribution } from "./mediaAttribution";

function fakeApi(get: ReturnType<typeof vi.fn>) {
  return { get } as never;
}

describe("fetchMediaAttribution", () => {
  it("returns an empty string for a missing url", async () => {
    const get = vi.fn();
    expect(await fetchMediaAttribution(fakeApi(get), undefined)).toBe("");
    expect(get).not.toHaveBeenCalled();
  });

  it("returns an empty string for a non-media url", async () => {
    const get = vi.fn();
    expect(await fetchMediaAttribution(fakeApi(get), "https://cdn.example.com/x.png")).toBe("");
    expect(get).not.toHaveBeenCalled();
  });

  it("requests the attribution endpoint for a media token url", async () => {
    const get = vi.fn().mockResolvedValue({ attribution: "Photo by Bob" });
    const result = await fetchMediaAttribution(fakeApi(get), "/api/media/tok123/");
    expect(result).toBe("Photo by Bob");
    expect(get).toHaveBeenCalledWith("/api/media/tok123/attribution/");
  });

  it("defaults to empty string when the response has no attribution", async () => {
    const get = vi.fn().mockResolvedValue({});
    expect(await fetchMediaAttribution(fakeApi(get), "/api/media/tok/")).toBe("");
  });

  it("swallows request errors and returns an empty string", async () => {
    const get = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await fetchMediaAttribution(fakeApi(get), "/api/media/tok/")).toBe("");
  });
});
