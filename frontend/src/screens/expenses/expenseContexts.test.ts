import { describe, expect, it } from "vitest";

import type { Friend, Group } from "../../shared/types/models";
import { activeExpenseContexts } from "./expenseContexts";

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
