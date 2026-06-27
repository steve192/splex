import { describe, expect, it } from "vitest";

import {
  CALCULATOR_KEY_FEEDBACK_MS,
  calculatorFeedbackRequest,
  calculatorFeedbackTarget,
} from "./calculatorFeedbackModel";

describe("calculatorFeedbackTarget", () => {
  it("uses browser vibration only when it is available on web", () => {
    expect(CALCULATOR_KEY_FEEDBACK_MS).toBeLessThan(10);
    expect(calculatorFeedbackTarget("web", true)).toBe("web");
    expect(calculatorFeedbackTarget("web", false)).toBeNull();
    expect(calculatorFeedbackTarget("android", false)).toBe("native");
  });

  it("uses a native duration instead of an Android delay-only pattern", () => {
    expect(calculatorFeedbackRequest("android", false)).toEqual({
      target: "native",
      durationMs: CALCULATOR_KEY_FEEDBACK_MS,
    });
    expect(calculatorFeedbackRequest("web", true)).toEqual({
      target: "web",
      pattern: [CALCULATOR_KEY_FEEDBACK_MS],
    });
    expect(calculatorFeedbackRequest("web", false)).toBeNull();
  });
});
