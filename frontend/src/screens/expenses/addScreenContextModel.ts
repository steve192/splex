import {
  buildParticipantsForFriend,
} from "../../shared/lib/money";
import type {
  ContextOption,
  Friend,
  Group,
  Participant,
  SplitMethod,
} from "../../shared/types/models";
import { isGroupArchived } from "../groups/groupArchivePolicy";

export type LoadedExpenseContext = Readonly<{
  archived: boolean;
  archivedContextOption: ContextOption | null;
  participants: Participant[];
  currentParticipantId: number | null;
  defaultCurrency: string;
  defaultSplitMethod?: SplitMethod;
}>;

export function groupContextOption(group: Group): ContextOption {
  return {
    type: "group",
    id: group.id,
    name: group.name,
    currency: group.default_currency,
    image_url: group.icon_url,
    last_expense_date: group.last_expense_date,
  };
}

export function friendContextOption(friend: Friend): ContextOption {
  return {
    type: "friendship",
    id: friend.id,
    name: friend.display_name,
    currency: friend.default_currency,
    image_url: friend.avatar_url,
    last_expense_date: friend.last_expense_date,
  };
}

export function activeContextOptions(groups: Group[], friends: Friend[]) {
  return [
    ...groups.map(groupContextOption),
    ...friends.map(friendContextOption),
  ].sort((a, b) => {
    const aDate = a.last_expense_date
      ? new Date(a.last_expense_date).getTime()
      : 0;
    const bDate = b.last_expense_date
      ? new Date(b.last_expense_date).getTime()
      : 0;
    if (aDate !== bDate) return bDate - aDate;
    return a.name.localeCompare(b.name);
  });
}

export function loadedGroupContext(group: Group): LoadedExpenseContext {
  const archived = isGroupArchived(group);
  return {
    archived,
    archivedContextOption: archived ? groupContextOption(group) : null,
    participants: group.participants ?? [],
    currentParticipantId: group.current_participant_id ?? null,
    defaultCurrency: group.default_currency,
    defaultSplitMethod: group.default_split_method,
  };
}

export function loadedFriendContext(friend: Friend): LoadedExpenseContext {
  return {
    archived: false,
    archivedContextOption: null,
    participants: buildParticipantsForFriend(friend),
    currentParticipantId: friend.current_participant_id ?? null,
    defaultCurrency: friend.default_currency,
  };
}

export function nextPayerId(
  currentPayerId: number | null,
  loadedContext: LoadedExpenseContext,
): number | null {
  return (
    currentPayerId ??
    loadedContext.currentParticipantId ??
    loadedContext.participants[0]?.id ??
    null
  );
}

export function shouldApplyContextDefaults({
  hasLoadedExpense,
  pendingMutationId,
}: Readonly<{
  hasLoadedExpense: boolean;
  pendingMutationId?: string;
}>): boolean {
  return !hasLoadedExpense && !pendingMutationId;
}

export function selectedExpenseContext({
  options,
  archivedOption,
  contextType,
  contextId,
}: Readonly<{
  options: ContextOption[];
  archivedOption: ContextOption | null;
  contextType: ContextOption["type"];
  contextId: number | null;
}>): ContextOption | undefined {
  return (
    options.find(
      (option) => option.type === contextType && option.id === contextId,
    ) ?? matchingArchivedContext(archivedOption, contextType, contextId)
  );
}

function matchingArchivedContext(
  archivedOption: ContextOption | null,
  contextType: ContextOption["type"],
  contextId: number | null,
): ContextOption | undefined {
  if (archivedOption?.type !== contextType) return undefined;
  return archivedOption.id === contextId ? archivedOption : undefined;
}

export function allParticipantsSelected(
  participants: Participant[],
  selectedParticipantIds: number[],
): boolean {
  return (
    participants.length > 0 &&
    selectedParticipantIds.length === participants.length &&
    participants.every((participant) =>
      selectedParticipantIds.includes(participant.id),
    )
  );
}
