import { describe, expect, it } from "vitest";

import type { Expense, Friend, Group } from "../../shared/types/models";
import {
  activeExpenseContexts,
  eligibleExpenseMoveGroups,
  hasAlternativeExpenseMoveGroup,
} from "./expenseContexts";

describe("activeExpenseContexts", () => {
  it("excludes archived groups and friendships from expense creation choices", () => {
    const groups = [
      { id: 1, name: "Active", default_currency: "EUR", archived_at: null },
      {
        id: 2,
        name: "Archived",
        default_currency: "EUR",
        archived_at: "2026-01-01T00:00:00Z",
      },
    ] satisfies Group[];
    const friends = [
      {
        id: 3,
        display_name: "Active Friend",
        participant_id: 30,
        default_currency: "EUR",
        balance: "0.00",
        archived_at: null,
      },
      {
        id: 4,
        display_name: "Archived Friend",
        participant_id: 40,
        default_currency: "EUR",
        balance: "0.00",
        archived_at: "2026-01-01T00:00:00Z",
      },
    ] satisfies Friend[];

    expect(activeExpenseContexts(groups, friends)).toEqual({
      groups: [groups[0]],
      friends: [friends[0]],
    });
  });
});

describe("eligibleExpenseMoveGroups", () => {
  const expense = {
    id: 10,
    group_id: 1,
    description: "Dinner",
    date: "2026-06-19",
    original_amount: "40.00",
    original_currency: "EUR",
    converted_amount: "40.00",
    converted_currency: "EUR",
    split_method: "equal_selected",
    payments: [{ participant_id: 1, amount: "40.00" }],
    owed: [
      { participant_id: 1, amount: "20.00" },
      { participant_id: 2, amount: "20.00" },
    ],
  } satisfies Expense;

  it("keeps only groups containing every payer and payee", () => {
    const groups = [
      groupWithParticipants(1, [1, 2]),
      groupWithParticipants(2, [1, 2, 3]),
      groupWithParticipants(3, [1, 3]),
      { id: 4, name: "List row", default_currency: "EUR" },
    ] satisfies Group[];

    expect(eligibleExpenseMoveGroups(groups, expense).map((group) => group.id))
      .toEqual([1, 2]);
  });

  it("detects whether there is a different eligible group", () => {
    expect(
      hasAlternativeExpenseMoveGroup(1, [groupWithParticipants(1, [1, 2])]),
    ).toBe(false);
    expect(
      hasAlternativeExpenseMoveGroup(1, [
        groupWithParticipants(1, [1, 2]),
        groupWithParticipants(2, [1, 2]),
      ]),
    ).toBe(true);
  });
});

function groupWithParticipants(id: number, participantIds: number[]): Group {
  return {
    id,
    name: `Group ${id}`,
    default_currency: "EUR",
    participants: participantIds.map((participantId) => ({
      id: participantId,
      display_name: `P${participantId}`,
      kind: "registered",
      user_id: participantId,
    })),
  };
}
