export const CALCULATOR_KEY_FEEDBACK_MS = 8;

export type CalculatorFeedbackTarget = "native" | "web";

export function calculatorFeedbackTarget(
  platform: string,
  webVibrationAvailable: boolean,
): CalculatorFeedbackTarget | null {
  if (platform === "web") return webVibrationAvailable ? "web" : null;
  return "native";
}
