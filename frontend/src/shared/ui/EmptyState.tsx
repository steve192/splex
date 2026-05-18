import { Image, ImageSourcePropType } from "react-native";
import { Card, Text } from "react-native-paper";

import { styles } from "./styles";

export function EmptyState({ image, text }: { image?: ImageSourcePropType; text: string }) {
  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content style={styles.emptyStateContent}>
        {image ? <Image source={image} style={styles.emptyStateImage} resizeMode="contain" /> : null}
        <Text variant="bodyMedium">{text}</Text>
      </Card.Content>
    </Card>
  );
}
