import { describe, expect, it } from "vitest";

import { loadedCountAfterPage, refreshOffsets } from "./usePaginatedFeed";

describe("loadedCountAfterPage", () => {
  it("uses fetched page size for the first page", () => {
    expect(loadedCountAfterPage({ offset: 0, currentLoadedCount: 10, pageItemCount: 30 })).toBe(30);
  });

  it("adds only fetched rows when appending so prepended local rows are ignored", () => {
    expect(loadedCountAfterPage({ offset: 30, currentLoadedCount: 30, pageItemCount: 30 })).toBe(60);
  });
});

describe("refreshOffsets", () => {
  it("always refreshes at least the first page", () => {
    expect(refreshOffsets(0, 30)).toEqual([0]);
  });

  it("covers every loaded page", () => {
    expect(refreshOffsets(61, 30)).toEqual([0, 30, 60]);
  });
});
