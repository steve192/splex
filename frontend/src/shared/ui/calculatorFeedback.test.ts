import { describe, expect, it } from "vitest";

import {
  CALCULATOR_KEY_FEEDBACK_MS,
  calculatorFeedbackTarget,
} from "./calculatorFeedbackModel";

describe("calculatorFeedbackTarget", () => {
  it("uses browser vibration only when it is available on web", () => {
    expect(CALCULATOR_KEY_FEEDBACK_MS).toBeLessThan(10);
    expect(calculatorFeedbackTarget("web", true)).toBe("web");
    expect(calculatorFeedbackTarget("web", false)).toBeNull();
    expect(calculatorFeedbackTarget("android", false)).toBe("native");
  });
});
