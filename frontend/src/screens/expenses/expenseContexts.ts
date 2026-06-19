import type { Friend, Group } from "../../shared/types/models";

export function activeExpenseContexts(
  groups: Group[],
  friends: Friend[],
): { groups: Group[]; friends: Friend[] } {
  return {
    groups: groups.filter((group) => !group.archived_at),
    friends: friends.filter((friend) => !friend.archived_at),
  };
}
