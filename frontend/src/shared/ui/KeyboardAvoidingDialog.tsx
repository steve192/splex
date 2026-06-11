import { ComponentProps } from "react";
import { Dialog } from "react-native-paper";

import { useKeyboardHeight } from "../lib/useKeyboardHeight";

type DialogProps = ComponentProps<typeof Dialog>;

/**
 * Drop-in replacement for react-native-paper's `Dialog` that lifts itself clear
 * of the on-screen keyboard.
 *
 * Paper renders dialogs vertically centred and does not react to the keyboard,
 * so a focused `TextInput` near the bottom of a dialog ends up hidden behind it.
 * Adding `marginBottom` to the centred dialog shifts it upwards by half that
 * value, which is enough to bring the inputs above the keyboard while keeping
 * the title on screen. When the keyboard is closed the margin is 0, so the
 * dialog stays exactly where paper would put it.
 *
 * Use this instead of `Dialog` anywhere a dialog contains a `TextInput`.
 */
export function KeyboardAvoidingDialog({ style, ...props }: Readonly<DialogProps>) {
  const keyboardHeight = useKeyboardHeight();
  return <Dialog {...props} style={[{ marginBottom: keyboardHeight }, style]} />;
}
