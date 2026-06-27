import { describe, expect, it } from "vitest";

import type { Participant } from "../../shared/types/models";
import {
  canSaveSettlementEdit,
  settlementParticipantName,
  settlementParticipantOptions,
} from "./settlementDetailModel";

const participants: Participant[] = [
  { id: 1, display_name: "Alice", kind: "registered", user_id: 10 },
  { id: 2, display_name: "Bob", kind: "registered", user_id: 11 },
];

describe("settlementParticipantName", () => {
  it("returns the participant display name or an empty fallback", () => {
    expect(settlementParticipantName(participants, 1)).toBe("Alice");
    expect(settlementParticipantName(participants, 99)).toBe("");
    expect(settlementParticipantName(participants, null)).toBe("");
  });
});

describe("settlementParticipantOptions", () => {
  it("maps participants to selection options", () => {
    expect(settlementParticipantOptions(participants)).toEqual([
      { value: 1, label: "Alice" },
      { value: 2, label: "Bob" },
    ]);
  });
});

describe("canSaveSettlementEdit", () => {
  it("requires amount, distinct participants, no pending action, and active group", () => {
    const base = {
      hasPending: false,
      amount: "12.00",
      payerId: 1,
      receiverId: 2,
      groupArchived: false,
    };

    expect(canSaveSettlementEdit(base)).toBe(true);
    expect(canSaveSettlementEdit({ ...base, amount: "" })).toBe(false);
    expect(canSaveSettlementEdit({ ...base, payerId: 2 })).toBe(false);
    expect(canSaveSettlementEdit({ ...base, hasPending: true })).toBe(false);
    expect(canSaveSettlementEdit({ ...base, groupArchived: true })).toBe(false);
  });
});
