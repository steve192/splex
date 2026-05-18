import { ImageSourcePropType } from "react-native";

export const appImages = {
  appIcon: require("../../../assets/images/app-icon.png") as ImageSourcePropType,
  appIconForeground: require("../../../assets/images/app-icon-foreground.png") as ImageSourcePropType,
  emptyActivity: require("../../../assets/images/empty-activity.png") as ImageSourcePropType,
  emptyExpenses: require("../../../assets/images/empty-expenses.png") as ImageSourcePropType,
  emptyGroupsFriends: require("../../../assets/images/empty-groups-friends.png") as ImageSourcePropType,
  invitationExpired: require("../../../assets/images/invitation-expired.png") as ImageSourcePropType,
  offlineSync: require("../../../assets/images/offline-sync.png") as ImageSourcePropType,
  pwaMaskableIcon: require("../../../assets/images/pwa-maskable-icon.png") as ImageSourcePropType,
  settlementSuccess: require("../../../assets/images/settlement-success.png") as ImageSourcePropType,
  splashScreen: require("../../../assets/images/splash-screen.png") as ImageSourcePropType,
  successCheck: require("../../../assets/images/success-check.png") as ImageSourcePropType,
  groupAvatars: {
    couple: require("../../../assets/images/group-avatar-couple.png") as ImageSourcePropType,
    event: require("../../../assets/images/group-avatar-event.png") as ImageSourcePropType,
    food: require("../../../assets/images/group-avatar-food.png") as ImageSourcePropType,
    friends: require("../../../assets/images/group-avatar-friends.png") as ImageSourcePropType,
    general: require("../../../assets/images/group-avatar-general.png") as ImageSourcePropType,
    home: require("../../../assets/images/group-avatar-home.png") as ImageSourcePropType,
    team: require("../../../assets/images/group-avatar-team.png") as ImageSourcePropType,
    travel: require("../../../assets/images/group-avatar-travel.png") as ImageSourcePropType
  }
};

const groupAvatarKeys = [
  "general",
  "friends",
  "home",
  "food",
  "travel",
  "event",
  "couple",
  "team"
] as const;

export function defaultGroupAvatar(name: string | undefined): ImageSourcePropType {
  const normalized = (name ?? "").trim().toLowerCase();
  if (!normalized) return appImages.groupAvatars.general;
  if (/\b(travel|trip|urlaub|reise|vacation)\b/.test(normalized)) return appImages.groupAvatars.travel;
  if (/\b(home|flat|apartment|house|wohnung|haus|wg)\b/.test(normalized)) return appImages.groupAvatars.home;
  if (/\b(food|restaurant|dinner|lunch|essen|meal)\b/.test(normalized)) return appImages.groupAvatars.food;
  if (/\b(event|party|wedding|feier|festival)\b/.test(normalized)) return appImages.groupAvatars.event;
  if (/\b(team|project|work|arbeit|projekt)\b/.test(normalized)) return appImages.groupAvatars.team;
  if (/\b(couple|partner|date|paar)\b/.test(normalized)) return appImages.groupAvatars.couple;

  const hash = Array.from(normalized).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return appImages.groupAvatars[groupAvatarKeys[hash % groupAvatarKeys.length]];
}
