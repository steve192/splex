import { Card, Text } from "react-native-paper";

import { styles } from "./styles";

export function EmptyState({ text }: { text: string }) {
  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content>
        <Text variant="bodyMedium">{text}</Text>
      </Card.Content>
    </Card>
  );
}
