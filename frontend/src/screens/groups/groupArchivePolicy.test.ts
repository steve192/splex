import { describe, expect, it } from "vitest";

import { groupMutationDisabled, isGroupArchived } from "./groupArchivePolicy";

describe("groupArchivePolicy", () => {
  it("treats groups with an archive timestamp as archived", () => {
    expect(isGroupArchived({ archived_at: "2026-06-19T12:00:00Z" })).toBe(
      true,
    );
    expect(isGroupArchived({ archived_at: null })).toBe(false);
    expect(isGroupArchived(null)).toBe(false);
  });

  it("disables user mutations for pending or archived groups", () => {
    expect(groupMutationDisabled({ archived_at: null }, false)).toBe(false);
    expect(groupMutationDisabled({ archived_at: null }, true)).toBe(true);
    expect(groupMutationDisabled(null, false)).toBe(true);
    expect(
      groupMutationDisabled({ archived_at: "2026-06-19T12:00:00Z" }, false),
    ).toBe(true);
  });
});
