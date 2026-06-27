import { describe, expect, it } from "vitest";

import type { Friend, Group } from "../../shared/types/models";
import {
  activeContextOptions,
  allParticipantsSelected,
  loadedFriendContext,
  loadedGroupContext,
  nextPayerId,
  selectedExpenseContext,
  shouldApplyContextDefaults,
} from "./addScreenContextModel";

const group: Group = {
  id: 1,
  name: "Trip",
  default_currency: "EUR",
  default_split_method: "exact",
  current_participant_id: 11,
  participants: [
    { id: 11, display_name: "Alice", kind: "registered", user_id: 1 },
    { id: 12, display_name: "Bob", kind: "registered", user_id: 2 },
  ],
};

const friend: Friend = {
  id: 2,
  display_name: "Charlie",
  participant_id: 20,
  current_participant_id: 21,
  default_currency: "USD",
  balance: "0.00",
};

describe("activeContextOptions", () => {
  it("sorts contexts by recent expense date, then name", () => {
    expect(
      activeContextOptions(
        [{ ...group, name: "Zoo", last_expense_date: null }],
        [{ ...friend, display_name: "Alpha", last_expense_date: "2026-06-01" }],
      ).map((option) => option.name),
    ).toEqual(["Alpha", "Zoo"]);
  });
});

describe("loaded context models", () => {
  it("normalizes group context state", () => {
    expect(loadedGroupContext(group)).toMatchObject({
      archived: false,
      participants: group.participants,
      currentParticipantId: 11,
      defaultCurrency: "EUR",
      defaultSplitMethod: "exact",
    });
  });

  it("normalizes friend context state", () => {
    expect(loadedFriendContext(friend)).toMatchObject({
      archived: false,
      currentParticipantId: 21,
      defaultCurrency: "USD",
    });
  });
});

describe("context defaults", () => {
  it("preserves an existing payer and otherwise prefers current participant", () => {
    const loadedContext = loadedGroupContext(group);

    expect(nextPayerId(12, loadedContext)).toBe(12);
    expect(nextPayerId(null, loadedContext)).toBe(11);
  });

  it("applies context defaults only for new non-pending expenses", () => {
    expect(
      shouldApplyContextDefaults({
        hasLoadedExpense: false,
        pendingMutationId: undefined,
      }),
    ).toBe(true);
    expect(
      shouldApplyContextDefaults({
        hasLoadedExpense: true,
        pendingMutationId: undefined,
      }),
    ).toBe(false);
    expect(
      shouldApplyContextDefaults({
        hasLoadedExpense: false,
        pendingMutationId: "pending-1",
      }),
    ).toBe(false);
  });
});

describe("selectedExpenseContext", () => {
  it("finds active contexts and falls back to matching archived context", () => {
    const archivedOption = {
      type: "group" as const,
      id: 99,
      name: "Archived",
      currency: "EUR",
    };

    expect(
      selectedExpenseContext({
        options: activeContextOptions([group], [friend]),
        archivedOption,
        contextType: "friendship",
        contextId: 2,
      })?.name,
    ).toBe("Charlie");
    expect(
      selectedExpenseContext({
        options: [],
        archivedOption,
        contextType: "group",
        contextId: 99,
      }),
    ).toBe(archivedOption);
  });
});

describe("allParticipantsSelected", () => {
  it("checks both participant count and membership", () => {
    const participants = group.participants ?? [];

    expect(allParticipantsSelected(participants, [11, 12])).toBe(true);
    expect(allParticipantsSelected(participants, [11])).toBe(false);
    expect(allParticipantsSelected(participants, [11, 99])).toBe(false);
  });
});
