import { describe, expect, it } from "vitest";

import type { Friend, Group } from "../../shared/types/models";
import { overviewItemsFromRows } from "./overviewItems";

describe("overviewItemsFromRows", () => {
  it("builds overview cards from group and friend API rows", () => {
    const groups: Group[] = [
      {
        id: 1,
        name: "Trip",
        default_currency: "EUR",
        icon_url: "group.png",
        balance: "12.50",
        archived_at: null,
      },
    ];
    const friends: Friend[] = [
      {
        id: 2,
        display_name: "Alex",
        participant_id: 9,
        default_currency: "USD",
        avatar_url: "alex.png",
        balance: "-4.00",
        archived_at: "2026-01-01T00:00:00Z",
      },
    ];

    expect(overviewItemsFromRows(groups, friends)).toEqual([
      {
        type: "group",
        id: 1,
        name: "Trip",
        icon_url: "group.png",
        currency: "EUR",
        balance: "12.50",
        archived_at: null,
      },
      {
        type: "friend",
        id: 2,
        name: "Alex",
        avatar_url: "alex.png",
        currency: "USD",
        balance: "-4.00",
        archived_at: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("uses a zero balance for cached group rows from the old schema", () => {
    expect(
      overviewItemsFromRows(
        [{ id: 1, name: "Trip", default_currency: "EUR" }],
        [],
      )[0].balance,
    ).toBe("0.00");
  });
});
