import { describe, expect, it } from "vitest";

import { Friend, Participant } from "../../shared/types/models";
import {
  buildAddParticipantPayload,
  getSuggestedFriends,
  shouldDeleteGroupOnLeave
} from "./groupSettingsHelpers";

const friends: Friend[] = [
  {
    id: 1,
    display_name: "Alice Example",
    participant_id: 11,
    default_currency: "EUR",
    balance: "0"
  },
  {
    id: 2,
    display_name: "Bob Example",
    participant_id: 22,
    default_currency: "EUR",
    balance: "0"
  }
];

const participants: Participant[] = [
  { id: 22, display_name: "Bob Example", kind: "registered", user_id: 2 }
];

describe("groupSettingsHelpers", () => {
  it("filters suggestions to matching friends not already in the group", () => {
    expect(getSuggestedFriends("exa", friends, participants).map((friend) => friend.id)).toEqual([1]);
  });

  it("builds a registered-friend payload for an exact friend match", () => {
    expect(buildAddParticipantPayload(" Alice Example ", friends, participants)).toEqual({
      friend_participant_id: 11
    });
  });

  it("builds an unregistered payload when there is no exact friend match", () => {
    expect(buildAddParticipantPayload("Charlie", friends, participants)).toEqual({
      display_name: "Charlie"
    });
  });

  it("treats groups with only unregistered members besides you as delete-on-leave", () => {
    expect(
      shouldDeleteGroupOnLeave(
        [
          { id: 10, display_name: "You", kind: "registered", user_id: 10 },
          { id: 20, display_name: "Ghost", kind: "unregistered", user_id: null }
        ],
        10
      )
    ).toBe(true);
  });

  it("does not treat groups with another registered member as delete-on-leave", () => {
    expect(
      shouldDeleteGroupOnLeave(
        [
          { id: 10, display_name: "You", kind: "registered", user_id: 10 },
          { id: 30, display_name: "Other", kind: "registered", user_id: 30 },
          { id: 20, display_name: "Ghost", kind: "unregistered", user_id: null }
        ],
        10
      )
    ).toBe(false);
  });
});