import { describe, expect, it } from "vitest";

import { detailActionState } from "./detailActionState";

describe("detailActionState", () => {
  it("keeps deleted records read-only before archive state", () => {
    expect(detailActionState({ archived: true, deleted: true })).toBe("deleted");
  });

  it("marks archived live records read-only", () => {
    expect(detailActionState({ archived: true, deleted: false })).toBe("archived");
  });

  it("allows actions for live records in active groups", () => {
    expect(detailActionState({ archived: false, deleted: false })).toBe("editable");
  });
});
