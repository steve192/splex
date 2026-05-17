import { ReactNode } from "react";
import { ScrollView } from "react-native";
import { useTheme } from "react-native-paper";

import { ContentWidth } from "./ContentWidth";
import { styles } from "./styles";

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ContentWidth>{children}</ContentWidth>
    </ScrollView>
  );
}
