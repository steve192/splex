import { describe, expect, it } from "vitest";

import { pendingInviteTokenForAuthSession } from "./appNavigatorInvite";

describe("pendingInviteTokenForAuthSession", () => {
  it("prefers an invite token from the current URL", () => {
    expect(pendingInviteTokenForAuthSession("url-token", "stored-token")).toBe("url-token");
  });

  it("uses a stored invite token when the URL has none", () => {
    expect(pendingInviteTokenForAuthSession(null, "stored-token")).toBe("stored-token");
  });

  it("returns null when no pending invite token exists", () => {
    expect(pendingInviteTokenForAuthSession(null, null)).toBeNull();
  });
});
