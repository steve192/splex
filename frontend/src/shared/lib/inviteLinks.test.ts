import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" }
}));

import { clearUrlQuery, inviteTokenFromCurrentUrl, tokenFromCurrentUrl } from "./inviteLinks";

describe("invite links", () => {
  beforeEach(() => {
    // The app is served under /app, so deep links carry that prefix.
    const url = "http://localhost:8000/app/invite/abc123?token=magic-token";
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { href: url, pathname: "/app/invite/abc123" },
        history: { replaceState: vi.fn() }
      },
      writable: true
    });
    Object.defineProperty(globalThis, "document", { value: { title: "Splex" }, writable: true });
  });

  it("reads token query parameter for magic login", () => {
    expect(tokenFromCurrentUrl("token")).toBe("magic-token");
  });

  it("reads invite token from a /app-prefixed path", () => {
    expect(inviteTokenFromCurrentUrl()).toBe("abc123");
  });

  it("clears browser url to the app root", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    clearUrlQuery();
    expect(replaceState).toHaveBeenCalledWith({}, "Splex", "/app/");
  });
});
