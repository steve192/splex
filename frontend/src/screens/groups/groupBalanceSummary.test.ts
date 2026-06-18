import { describe, expect, it } from "vitest";

import { GroupBalance } from "../../shared/types/models";
import { buildBalanceSummary } from "./groupBalanceSummary";

describe("buildBalanceSummary", () => {
  it("summarizes incoming and outgoing details for the current participant", () => {
    const balances: GroupBalance[] = [
      {
        participant_id: 1,
        display_name: "You",
        amount: "0",
        currency: "EUR",
        details: [
          {
            from_participant_id: 2,
            from_display_name: "Alice",
            to_participant_id: 1,
            to_display_name: "You",
            amount: "10.50",
            currency: "EUR"
          },
          {
            from_participant_id: 1,
            from_display_name: "You",
            to_participant_id: 3,
            to_display_name: "Bob",
            amount: "4.25",
            currency: "EUR"
          }
        ]
      }
    ];

    const summary = buildBalanceSummary(balances, 1, "USD");

    expect(summary.currency).toBe("EUR");
    expect(summary.incoming.map((detail) => detail.from_display_name)).toEqual(["Alice"]);
    expect(summary.outgoing.map((detail) => detail.to_display_name)).toEqual(["Bob"]);
    expect(summary.total).toBeCloseTo(6.25);
  });

  it("falls back to the group currency when the current participant is missing", () => {
    expect(buildBalanceSummary([], 1, "CHF")).toEqual({
      currency: "CHF",
      incoming: [],
      outgoing: [],
      total: 0
    });
  });
});
