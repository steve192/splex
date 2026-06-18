import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCREEN_KEYBOARD_DISMISS_MODE,
  DEFAULT_SCREEN_KEYBOARD_TAPS,
  screenBottomPadding
} from "./screenKeyboard";

describe("screen keyboard behavior", () => {
  it("keeps the keyboard available while scrolling by default", () => {
    expect(DEFAULT_SCREEN_KEYBOARD_DISMISS_MODE).toBe("none");
    expect(DEFAULT_SCREEN_KEYBOARD_TAPS).toBe("handled");
  });

  it("adds keyboard height to the screen bottom padding", () => {
    expect(screenBottomPadding(20, 0)).toBe(20);
    expect(screenBottomPadding(20, 280)).toBe(300);
    expect(screenBottomPadding(20, -1)).toBe(20);
  });
});
