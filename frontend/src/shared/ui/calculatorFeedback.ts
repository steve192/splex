import { Platform, Vibration } from "react-native";

import {
  calculatorFeedbackRequest,
} from "./calculatorFeedbackModel";

export function triggerCalculatorKeyFeedback(): void {
  try {
    const webVibrate = globalThis.navigator?.vibrate;
    const request = calculatorFeedbackRequest(
      Platform.OS,
      typeof webVibrate === "function",
    );
    if (request?.target === "web") {
      webVibrate.call(globalThis.navigator, request.pattern);
      return;
    }
    if (request?.target === "native") {
      Vibration.vibrate(request.durationMs);
    }
  } catch {
    // Haptic feedback is intentionally best-effort; unsupported browsers/devices
    // should never make calculator input fail.
  }
}
