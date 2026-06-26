import { Platform, Vibration } from "react-native";

import {
  CALCULATOR_KEY_FEEDBACK_MS,
  calculatorFeedbackTarget,
} from "./calculatorFeedbackModel";

const CALCULATOR_KEY_FEEDBACK_PATTERN = [CALCULATOR_KEY_FEEDBACK_MS];

export function triggerCalculatorKeyFeedback(): void {
  try {
    const webVibrate = globalThis.navigator?.vibrate;
    const target = calculatorFeedbackTarget(
      Platform.OS,
      typeof webVibrate === "function",
    );
    if (target === "web") {
      webVibrate.call(globalThis.navigator, CALCULATOR_KEY_FEEDBACK_PATTERN);
      return;
    }
    if (target === "native") {
      Vibration.vibrate(CALCULATOR_KEY_FEEDBACK_PATTERN);
    }
  } catch {
    // Haptic feedback is intentionally best-effort; unsupported browsers/devices
    // should never make calculator input fail.
  }
}
