import { Friend, Participant } from "../../shared/types/models";

type AddParticipantPayload = { display_name: string } | { friend_participant_id: number };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function getSuggestedFriends(
  query: string,
  friends: Friend[],
  participants: Participant[]
): Friend[] {
  const normalized = normalizeName(query);
  if (!normalized) return [];
  const existingParticipantIds = new Set(participants.map((participant) => participant.id));
  return friends
    .filter((friend) => !existingParticipantIds.has(friend.participant_id))
    .filter((friend) => normalizeName(friend.display_name).includes(normalized))
    .sort((left, right) => left.display_name.localeCompare(right.display_name));
}

export function buildAddParticipantPayload(
  query: string,
  friends: Friend[],
  participants: Participant[]
): AddParticipantPayload | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const suggestedFriends = getSuggestedFriends(trimmed, friends, participants);
  const exactMatch = suggestedFriends.find(
    (friend) => normalizeName(friend.display_name) === normalizeName(trimmed)
  );
  if (exactMatch) {
    return { friend_participant_id: exactMatch.participant_id };
  }
  return { display_name: trimmed };
}