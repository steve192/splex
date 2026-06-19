import { describe, expect, it } from "vitest";

import { itemsAfterPage, loadedCountAfterPage, refreshOffsets } from "./usePaginatedFeed";

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

describe("itemsAfterPage", () => {
  it("appends loaded pages so prepended local rows stay visible", () => {
    expect(
      itemsAfterPage({
        currentItems: ["pending", "remote-1", "remote-2"],
        pageItems: ["remote-3"],
        offset: 2,
        replaceOffset: false
      })
    ).toEqual(["pending", "remote-1", "remote-2", "remote-3"]);
  });

  it("replaces an offset page when delayed fresh cache data arrives", () => {
    expect(
      itemsAfterPage({
        currentItems: ["old-1", "old-2", "old-3"],
        pageItems: ["new-2"],
        offset: 1,
        replaceOffset: true
      })
    ).toEqual(["old-1", "new-2", "old-3"]);
  });
});
