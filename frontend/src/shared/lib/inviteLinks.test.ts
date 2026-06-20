import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" }
}));

import {
  clearUrlQuery,
  inviteTokenFromCurrentUrl,
  inviteTokenFromUrl,
  tokenFromCurrentUrl,
  tokenFromUrl
} from "./inviteLinks";

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

  it("reads invite token from a native Android universal link", () => {
    expect(inviteTokenFromUrl("https://splex.sterul.com/app/invite/native123")).toBe("native123");
  });

  it("reads invite token from a magic-link query parameter", () => {
    expect(
      inviteTokenFromUrl("https://splex.sterul.com/app/login/magic?token=magic-token&inviteToken=invite123")
    ).toBe("invite123");
  });

  it("reads magic token from a native magic link", () => {
    expect(
      tokenFromUrl("https://splex.sterul.com/app/login/magic?token=magic-token&inviteToken=invite123")
    ).toBe("magic-token");
  });

  it("clears browser url to the app root", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    clearUrlQuery();
    expect(replaceState).toHaveBeenCalledWith({}, "Splex", "/app/");
  });
});
