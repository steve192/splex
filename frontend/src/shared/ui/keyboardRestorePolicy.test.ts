import { describe, expect, it } from "vitest";

import { shouldRestoreKeyboard } from "./keyboardRestorePolicy";

describe("shouldRestoreKeyboard", () => {
  it("restores only a keyboard that was visible before opening the calculator", () => {
    expect(shouldRestoreKeyboard(0)).toBe(false);
    expect(shouldRestoreKeyboard(280)).toBe(true);
  });
});
