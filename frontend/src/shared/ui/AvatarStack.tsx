import { View } from "react-native";
import { Avatar, Text } from "react-native-paper";

import { ExpenseShare } from "../types/models";
import { PersonAvatar } from "./PersonAvatar";

export function AvatarStack({ people, size = 34 }: Readonly<{ people: ExpenseShare[]; size?: number }>) {
  const visible = people.slice(0, 2);
  const extra = people.length - visible.length;
  return (
    <View style={{ flexDirection: "row", minWidth: people.length > 1 ? size + 18 : size }}>
      {visible.map((person, index) => (
        <View key={`${person.participant_id}-${index}`} style={{ marginLeft: index ? -12 : 0 }}>
          <PersonAvatar name={person.display_name} imageUrl={person.avatar_url} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={{ marginLeft: -12 }}>
          <Avatar.Text size={size} label={`+${extra}`} />
        </View>
      ) : null}
    </View>
  );
}
