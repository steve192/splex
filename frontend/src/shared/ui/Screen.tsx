import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "../lib/useKeyboardHeight";
import { ContentWidth } from "./ContentWidth";
import {
  DEFAULT_SCREEN_KEYBOARD_DISMISS_MODE,
  DEFAULT_SCREEN_KEYBOARD_TAPS,
  screenBottomPadding
} from "./screenKeyboard";
import { styles } from "./styles";

type ScreenProps = {
  children: ReactNode;
  topInset?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle" | "children">;
};

export function Screen({ children, topInset = false, contentContainerStyle, scrollViewProps }: Readonly<ScreenProps>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const baseBottomPadding = 20 + insets.bottom;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        {...scrollViewProps}
        keyboardDismissMode={scrollViewProps?.keyboardDismissMode ?? DEFAULT_SCREEN_KEYBOARD_DISMISS_MODE}
        keyboardShouldPersistTaps={scrollViewProps?.keyboardShouldPersistTaps ?? DEFAULT_SCREEN_KEYBOARD_TAPS}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        scrollEventThrottle={scrollViewProps?.scrollEventThrottle ?? 16}
        contentContainerStyle={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: 20 + (topInset ? insets.top : 0),
            paddingBottom: screenBottomPadding(baseBottomPadding, keyboardHeight)
          },
          contentContainerStyle
        ]}
      >
        <ContentWidth>{children}</ContentWidth>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
