import { describe, expect, it } from "vitest";

import type { Expense } from "../../shared/types/models";
import {
  expenseExchangeRateText,
  expensePersonalNet,
  isConvertedExpense,
} from "./expenseDetailModel";

const baseExpense: Expense = {
  id: 1,
  description: "Lunch",
  date: "2026-06-26",
  original_amount: "10.00",
  original_currency: "EUR",
  converted_amount: "10.00",
  converted_currency: "EUR",
  split_method: "equal_all",
  payments: [],
  owed: [],
};

describe("isConvertedExpense", () => {
  it("detects currency or amount conversion", () => {
    expect(isConvertedExpense(baseExpense)).toBe(false);
    expect(
      isConvertedExpense({
        ...baseExpense,
        converted_amount: "11.00",
      }),
    ).toBe(true);
    expect(
      isConvertedExpense({
        ...baseExpense,
        converted_currency: "USD",
      }),
    ).toBe(true);
  });
});

describe("expenseExchangeRateText", () => {
  it("shows the stored conversion rate for converted expenses", () => {
    expect(
      expenseExchangeRateText({
        ...baseExpense,
        original_currency: "NOK",
        converted_currency: "EUR",
        original_amount: "5000.00",
        converted_amount: "430.00",
        exchange_rate: "0.08600000",
      }),
    ).toBe("1 NOK = 0.08600000 EUR");
  });

  it("omits exchange-rate text when no conversion happened", () => {
    expect(expenseExchangeRateText(baseExpense)).toBeNull();
  });
});

describe("expensePersonalNet", () => {
  it("returns paid minus owed for the current participant", () => {
    expect(
      expensePersonalNet(
        {
          ...baseExpense,
          payments: [
            { participant_id: 7, amount: "20.00" },
            { participant_id: 8, amount: "5.00" },
          ],
          owed: [
            { participant_id: 7, amount: "8.50" },
            { participant_id: 8, amount: "16.50" },
          ],
        },
        7,
      ),
    ).toBe(11.5);
  });

  it("returns null when the current participant is unknown", () => {
    expect(expensePersonalNet(baseExpense, null)).toBeNull();
  });
});
