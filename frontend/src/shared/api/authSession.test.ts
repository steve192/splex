import { describe, expect, it } from "vitest";

import {
  isAuthenticationFailureStatus,
  shouldClearStoredAuth,
} from "./authSession";

describe("isAuthenticationFailureStatus", () => {
  it("only treats authentication failures as local logout triggers", () => {
    expect(isAuthenticationFailureStatus(401)).toBe(true);
    expect(isAuthenticationFailureStatus(403)).toBe(true);
    expect(isAuthenticationFailureStatus(400)).toBe(false);
    expect(isAuthenticationFailureStatus(500)).toBe(false);
    expect(isAuthenticationFailureStatus(undefined)).toBe(false);
  });
});

describe("shouldClearStoredAuth", () => {
  it("keeps cached auth for transient network and server failures", () => {
    expect(shouldClearStoredAuth({ offline: true })).toBe(false);
    expect(shouldClearStoredAuth({ status: 500 })).toBe(false);
    expect(shouldClearStoredAuth(new Error("Network unavailable"))).toBe(false);
  });

  it("clears cached auth for backend authentication failures", () => {
    expect(shouldClearStoredAuth({ status: 401 })).toBe(true);
    expect(shouldClearStoredAuth({ status: 403 })).toBe(true);
  });
});
