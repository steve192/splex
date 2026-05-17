import { Avatar } from "react-native-paper";

export function PersonAvatar({
  name,
  imageUrl,
  size = 36
}: {
  name?: string;
  imageUrl?: string;
  size?: number;
}) {
  if (imageUrl) {
    return <Avatar.Image size={size} source={{ uri: imageUrl }} />;
  }
  const label = (name?.trim()?.[0] || "?").toUpperCase();
  return <Avatar.Text size={size} label={label} />;
}
