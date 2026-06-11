import { afterEach, describe, expect, it, vi } from "vitest";

// Default to web; individual tests override Platform.OS as needed.
// vi.hoisted runs before the hoisted vi.mock factory, so `platform` is
// initialized by the time the factory references it.
const platform = vi.hoisted(() => ({ OS: "web" as string }));
vi.mock("react-native", () => ({ Platform: platform }));

import { openLegalDocument, openTermsOfService } from "./openTermsOfService";

describe("openLegalDocument", () => {
  afterEach(() => {
    platform.OS = "web";
    // @ts-expect-error reset the test-defined global window
    delete globalThis.window;
  });

  it("opens the matching web path in a new tab on web", () => {
    const open = vi.fn();
    Object.defineProperty(globalThis, "window", {
      value: { open, location: { href: "https://splex.example.com/account" } },
      configurable: true,
      writable: true
    });

    openLegalDocument("privacy", () => {
      throw new Error("native screen should not be opened on web");
    });

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0];
    expect(url).toBe("https://splex.example.com/privacy");
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");
  });

  it("resolves each known document kind to its path", () => {
    const open = vi.fn();
    Object.defineProperty(globalThis, "window", {
      value: { open, location: { href: "https://splex.example.com/" } },
      configurable: true,
      writable: true
    });

    openLegalDocument("tos", () => undefined);
    openLegalDocument("imprint", () => undefined);

    expect(open.mock.calls[0][0]).toBe("https://splex.example.com/tos");
    expect(open.mock.calls[1][0]).toBe("https://splex.example.com/imprint");
  });

  it("falls back to the native screen off web", () => {
    platform.OS = "android";
    const openNativeScreen = vi.fn();

    openLegalDocument("tos", openNativeScreen);

    expect(openNativeScreen).toHaveBeenCalledTimes(1);
  });

  it("falls back to the native screen on web when no window is present", () => {
    platform.OS = "web";
    const openNativeScreen = vi.fn();

    openLegalDocument("tos", openNativeScreen);

    expect(openNativeScreen).toHaveBeenCalledTimes(1);
  });

  it("openTermsOfService is a tos alias", () => {
    const open = vi.fn();
    Object.defineProperty(globalThis, "window", {
      value: { open, location: { href: "https://splex.example.com/" } },
      configurable: true,
      writable: true
    });

    openTermsOfService(() => undefined);

    expect(open.mock.calls[0][0]).toBe("https://splex.example.com/tos");
  });
});
