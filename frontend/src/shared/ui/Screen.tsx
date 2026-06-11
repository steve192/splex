import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentWidth } from "./ContentWidth";
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        {...scrollViewProps}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        scrollEventThrottle={scrollViewProps?.scrollEventThrottle ?? 16}
        contentContainerStyle={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: 20 + (topInset ? insets.top : 0),
            paddingBottom: 20 + insets.bottom
          },
          contentContainerStyle
        ]}
      >
        <ContentWidth>{children}</ContentWidth>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
