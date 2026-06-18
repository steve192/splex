export const DEFAULT_SCREEN_KEYBOARD_DISMISS_MODE = "none";
export const DEFAULT_SCREEN_KEYBOARD_TAPS = "handled";

export function screenBottomPadding(basePadding: number, keyboardHeight: number): number {
  return basePadding + Math.max(0, keyboardHeight);
}
