import { describe, expect, it } from "vitest";

import {
  canStartPendingAction,
  pendingActionMatches,
} from "./pendingActionState";

describe("pending action state", () => {
  it("allows a write action only when no action is pending", () => {
    expect(canStartPendingAction(null)).toBe(true);
    expect(canStartPendingAction("save")).toBe(false);
  });

  it("matches only the active pending action", () => {
    expect(pendingActionMatches("delete", "delete")).toBe(true);
    expect(pendingActionMatches("save", "delete")).toBe(false);
    expect(pendingActionMatches(null, "delete")).toBe(false);
  });
});
