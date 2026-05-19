import * as Clipboard from "expo-clipboard";
import { Platform } from "react-native";

export async function copyTextToClipboard(value: string): Promise<boolean> {
  if (!value) return false;

  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to Expo clipboard support.
    }
  }

  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}