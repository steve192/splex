import type { Expense, Friend, Group } from "../../shared/types/models";

export function activeExpenseContexts(
  groups: Group[],
  friends: Friend[],
): { groups: Group[]; friends: Friend[] } {
  return {
    groups: groups.filter((group) => !group.archived_at),
    friends: friends.filter((friend) => !friend.archived_at),
  };
}

export function expenseParticipantIds(expense: Expense | null): number[] {
  if (!expense) return [];
  return [
    ...new Set([
      ...expense.payments.map((share) => share.participant_id),
      ...expense.owed.map((share) => share.participant_id),
    ]),
  ];
}

export function groupContainsParticipants(
  group: Group,
  participantIds: number[],
): boolean {
  if (!participantIds.length) return false;
  const groupParticipantIds = new Set(
    (group.participants ?? []).map((participant) => participant.id),
  );
  return participantIds.every((participantId) =>
    groupParticipantIds.has(participantId),
  );
}

export function eligibleExpenseMoveGroups(
  groups: Group[],
  expense: Expense | null,
): Group[] {
  const participantIds = expenseParticipantIds(expense);
  return groups.filter((group) =>
    groupContainsParticipants(group, participantIds),
  );
}

export function hasAlternativeExpenseMoveGroup(
  currentGroupId: number | null | undefined,
  groups: Group[],
): boolean {
  if (currentGroupId == null) return false;
  return groups.some((group) => group.id !== currentGroupId);
}
