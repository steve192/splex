import { ImageSourcePropType } from "react-native";
import { Avatar } from "react-native-paper";

export function PersonAvatar({
  imageSource,
  name,
  imageUrl,
  size = 36
}: {
  imageSource?: ImageSourcePropType;
  name?: string;
  imageUrl?: string;
  size?: number;
}) {
  if (imageUrl) {
    return <Avatar.Image size={size} source={{ uri: imageUrl }} />;
  }
  if (imageSource) {
    return <Avatar.Image size={size} source={imageSource} />;
  }
  const label = (name?.trim()?.[0] || "?").toUpperCase();
  return <Avatar.Text size={size} label={label} />;
}
