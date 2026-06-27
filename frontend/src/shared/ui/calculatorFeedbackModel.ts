export const CALCULATOR_KEY_FEEDBACK_MS = 8;

export type CalculatorFeedbackTarget = "native" | "web";
export type CalculatorFeedbackRequest =
  | { target: "native"; durationMs: number }
  | { target: "web"; pattern: number[] };

export function calculatorFeedbackTarget(
  platform: string,
  webVibrationAvailable: boolean,
): CalculatorFeedbackTarget | null {
  if (platform === "web") return webVibrationAvailable ? "web" : null;
  return "native";
}

export function calculatorFeedbackRequest(
  platform: string,
  webVibrationAvailable: boolean,
): CalculatorFeedbackRequest | null {
  const target = calculatorFeedbackTarget(platform, webVibrationAvailable);
  if (target === "web") {
    return { target, pattern: [CALCULATOR_KEY_FEEDBACK_MS] };
  }
  if (target === "native") {
    return { target, durationMs: CALCULATOR_KEY_FEEDBACK_MS };
  }
  return null;
}
