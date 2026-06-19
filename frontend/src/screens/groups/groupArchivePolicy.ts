import type { Group } from "../../shared/types/models";

type GroupArchiveState = Pick<Group, "archived_at"> | null | undefined;

export function isGroupArchived(group: GroupArchiveState): boolean {
  return Boolean(group?.archived_at);
}

export function groupMutationDisabled(
  group: GroupArchiveState,
  hasPending = false,
): boolean {
  return hasPending || !group || isGroupArchived(group);
}
