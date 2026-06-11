import { useState } from "react";
import { ImageSourcePropType, Pressable, View } from "react-native";

import { ImageViewerModal } from "./ImageViewerModal";
import { PersonAvatar } from "./PersonAvatar";

type ClickableAvatarProps = {
  name?: string;
  imageUrl?: string;
  imageSource?: ImageSourcePropType;
  size?: number;
};

/**
 * PersonAvatar that opens a full-screen zoomable popup ({@link ImageViewerModal})
 * when tapped. Falls back to a plain PersonAvatar (non-interactive) when there
 * is no image to enlarge - tapping an initials bubble would just show an empty
 * popup.
 *
 * Attribution for the image is fetched on demand by the modal itself, so call
 * sites don't need to pass it (and serializers don't need to inline it next to
 * every avatar URL).
 *
 * Use this instead of PersonAvatar wherever the avatar represents a real
 * person/group and tapping it for a closer look doesn't conflict with the
 * surrounding control. Skip it when:
 *   - The avatar is part of an AvatarStack (multiple stacked thumbs).
 *   - It already lives inside another tappable surface (a list row whose
 *     onPress navigates somewhere, or an editing preview where tapping picks
 *     a new image).
 */
export function ClickableAvatar({ name, imageUrl, imageSource, size }: Readonly<ClickableAvatarProps>) {
  const [visible, setVisible] = useState(false);
  const canEnlarge = Boolean(imageUrl || imageSource);

  const avatar = (
    <PersonAvatar name={name} imageUrl={imageUrl} imageSource={imageSource} size={size} />
  );
  if (!canEnlarge) return avatar;

  return (
    <View>
      <Pressable onPress={() => setVisible(true)}>{avatar}</Pressable>
      <ImageViewerModal
        visible={visible}
        title={name}
        imageUrl={imageUrl}
        imageSource={imageSource}
        onDismiss={() => setVisible(false)}
      />
    </View>
  );
}
