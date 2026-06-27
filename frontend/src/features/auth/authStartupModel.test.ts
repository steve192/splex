import { describe, expect, it } from "vitest";

import { startupAuthErrorAction } from "./authStartupModel";

describe("startupAuthErrorAction", () => {
  it("preserves cached auth when the backend is temporarily unavailable", () => {
    expect(startupAuthErrorAction({ status: 500 })).toBe("preserve-auth");
    expect(startupAuthErrorAction({ offline: true })).toBe("preserve-auth");
    expect(startupAuthErrorAction(new Error("Network unavailable"))).toBe(
      "preserve-auth",
    );
  });

  it("clears cached auth only when the backend rejects the session", () => {
    expect(startupAuthErrorAction({ status: 401 })).toBe("clear-auth");
    expect(startupAuthErrorAction({ status: 403 })).toBe("clear-auth");
  });
});
