import { ReactNode } from "react";
import { View } from "react-native";

import { styles } from "./styles";

export function ContentWidth({ children }: Readonly<{ children: ReactNode }>) {
  return <View style={styles.contentWidth}>{children}</View>;
}
