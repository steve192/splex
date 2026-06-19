import type { Friend, Group, OverviewItem } from "../../shared/types/models";

export function groupOverviewItem(group: Group): OverviewItem {
  return {
    type: "group",
    id: group.id,
    name: group.name,
    icon_url: group.icon_url,
    currency: group.default_currency,
    balance: group.balance ?? "0.00",
    archived_at: group.archived_at,
  };
}

export function friendOverviewItem(friend: Friend): OverviewItem {
  return {
    type: "friend",
    id: friend.id,
    name: friend.display_name,
    avatar_url: friend.avatar_url,
    currency: friend.default_currency,
    balance: friend.balance,
    archived_at: friend.archived_at,
  };
}

export function overviewItemsFromRows(groups: Group[], friends: Friend[]): OverviewItem[] {
  return [...groups.map(groupOverviewItem), ...friends.map(friendOverviewItem)];
}
