import { ReactNode } from "react";
import { View } from "react-native";

import { styles } from "./styles";

export function ContentWidth({ children }: { children: ReactNode }) {
  return <View style={styles.contentWidth}>{children}</View>;
}
