import { describe, expect, it } from "vitest";

import {
  CALCULATOR_FULLSCREEN_MAX_WIDTH,
  CALCULATOR_HORIZONTAL_PADDING,
  CALCULATOR_KEY_GAP,
  CALCULATOR_POPUP_MAX_HEIGHT,
  CALCULATOR_POPUP_MAX_WIDTH,
  CALCULATOR_POPUP_VERTICAL_CHROME,
  CALCULATOR_RESULT_MIN_HEIGHT,
  calculatorKeySize,
  isCalculatorFullscreen
} from "./calculatorLayout";

describe("isCalculatorFullscreen", () => {
  it("uses the fullscreen calculator below the responsive breakpoint", () => {
    expect(isCalculatorFullscreen(CALCULATOR_FULLSCREEN_MAX_WIDTH - 1)).toBe(true);
    expect(isCalculatorFullscreen(CALCULATOR_FULLSCREEN_MAX_WIDTH)).toBe(false);
  });
});

describe("calculatorKeySize", () => {
  it("derives square key dimensions from the available calculator width", () => {
    expect(calculatorKeySize(360, 1200, true)).toBe(
      (360 - CALCULATOR_HORIZONTAL_PADDING - CALCULATOR_KEY_GAP * 3) / 4
    );
    expect(calculatorKeySize(1200, 1200, false)).toBe(
      (CALCULATOR_POPUP_MAX_WIDTH - CALCULATOR_HORIZONTAL_PADDING - CALCULATOR_KEY_GAP * 3) / 4
    );
  });

  it("reduces key size when popup height is the limiting dimension", () => {
    expect(calculatorKeySize(1200, 600, false)).toBe(
      (600 * CALCULATOR_POPUP_MAX_HEIGHT - CALCULATOR_POPUP_VERTICAL_CHROME) / 5
    );
  });
});

it("reserves a readable result area when calculator space is constrained", () => {
  expect(CALCULATOR_RESULT_MIN_HEIGHT).toBeGreaterThan(100);
});
