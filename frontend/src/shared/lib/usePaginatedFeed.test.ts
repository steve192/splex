import { describe, expect, it } from "vitest";

import {
  FeedPage,
  isCacheableFeedPage,
  itemsFromPages,
  nextOffsetFromPages,
  orderedPageOffsets,
  refreshOffsets,
} from "./usePaginatedFeed";

describe("refreshOffsets", () => {
  it("always refreshes at least the first page", () => {
    expect(refreshOffsets(0, 30)).toEqual([0]);
  });

  it("covers every loaded page", () => {
    expect(refreshOffsets(61, 30)).toEqual([0, 30, 60]);
  });
});

describe("isCacheableFeedPage", () => {
  it("uses the cache for unsearched feed pages", () => {
    expect(isCacheableFeedPage({ search: "" })).toBe(true);
  });

  it("bypasses the cache for searched pages", () => {
    expect(isCacheableFeedPage({ search: "coffee" })).toBe(false);
  });
});

describe("page map helpers", () => {
  function page(items: string[], nextOffset: number | null): FeedPage<string> {
    return { items, nextOffset };
  }

  it("orders pages by offset before rebuilding visible items", () => {
    const pages = new Map([
      [30, page(["remote-3"], 60)],
      [0, page(["remote-1", "remote-2"], 30)]
    ]);

    expect(orderedPageOffsets(pages)).toEqual([0, 30]);
    expect(itemsFromPages(pages)).toEqual(["remote-1", "remote-2", "remote-3"]);
  });

  it("takes the next offset from the highest loaded page", () => {
    const pages = new Map([
      [0, page(["remote-1"], 30)],
      [30, page(["remote-2"], 60)],
      [60, page(["remote-3"], null)]
    ]);

    expect(nextOffsetFromPages(pages)).toBeNull();
  });

  it("returns null for next offset when no pages are loaded", () => {
    expect(nextOffsetFromPages(new Map())).toBeNull();
  });
});
