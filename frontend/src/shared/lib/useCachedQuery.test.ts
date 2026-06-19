import { describe, expect, it } from "vitest";

import {
  cachedQueryLoading,
  cachedQueryLoadingInitial,
  cachedQueryRefreshCountAfterDelta
} from "./cachedQueryState";

describe("cachedQueryRefreshCountAfterDelta", () => {
  it("tracks pending background refreshes without going below zero", () => {
    expect(cachedQueryRefreshCountAfterDelta(0, 1)).toBe(1);
    expect(cachedQueryRefreshCountAfterDelta(2, -1)).toBe(1);
    expect(cachedQueryRefreshCountAfterDelta(0, -1)).toBe(0);
  });
});

describe("cachedQueryLoading", () => {
  it("is true while either foreground or background work is pending", () => {
    expect(cachedQueryLoading({ foregroundLoading: true, backgroundRefreshes: 0 })).toBe(true);
    expect(cachedQueryLoading({ foregroundLoading: false, backgroundRefreshes: 1 })).toBe(true);
    expect(cachedQueryLoading({ foregroundLoading: false, backgroundRefreshes: 0 })).toBe(false);
  });
});

describe("cachedQueryLoadingInitial", () => {
  it("only treats loading as initial when no data is available", () => {
    expect(cachedQueryLoadingInitial({ loading: true, hasData: false })).toBe(true);
    expect(cachedQueryLoadingInitial({ loading: true, hasData: true })).toBe(false);
  });
});
