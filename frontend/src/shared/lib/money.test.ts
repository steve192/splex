import { describe, expect, it } from "vitest";

import { asNumber, balanceText, buildParticipantsForFriend, formatMoney, moneyValue } from "./money";

describe("money helpers", () => {
  it("parses numbers safely", () => {
    expect(asNumber("12.5")).toBe(12.5);
    expect(asNumber(undefined)).toBe(0);
    expect(asNumber("abc")).toBe(0);
  });

  it("formats money with two decimals and absolute value", () => {
    expect(formatMoney("-2.5")).toBe("2.50");
  });

  it("normalizes decimal separator", () => {
    expect(moneyValue(" 12,34 ")).toBe("12.34");
  });

  it("builds balance text using translation keys", () => {
    const t = (key: string) =>
      ({ "balance.settled": "Settled", "balance.owedToYou": "Owed to you", "balance.youOwe": "You owe" })[key] ?? key;

    expect(balanceText(t, "0", "EUR")).toBe("Settled");
    expect(balanceText(t, "4.2", "EUR")).toBe("Owed to you 4.20 EUR");
    expect(balanceText(t, "-3", "EUR")).toBe("You owe 3.00 EUR");
  });

  it("builds friend participants with self + friend", () => {
    const participants = buildParticipantsForFriend({
      id: 1,
      display_name: "Stefan",
      avatar_url: "https://example.com/a.png",
      participant_id: 2,
      current_participant_id: 3,
      balance: "0",
      default_currency: "EUR"
    });
    expect(participants).toHaveLength(2);
    expect(participants[0].display_name).toBe("You");
    expect(participants[1].display_name).toBe("Stefan");
  });
});
