import { describe, expect, it } from "vitest";

import type { Expense } from "../types/models";
import { payerLine } from "./expenseLedgerRowModel";

const expense: Expense = {
  id: 1,
  description: "Cabin",
  date: "2026-06-28",
  original_amount: "5000.00",
  original_currency: "NOK",
  converted_amount: "430.00",
  converted_currency: "EUR",
  split_method: "equal_all",
  payments: [{ participant_id: 1, display_name: "Alice", amount: "430.00" }],
  owed: [],
};

describe("payerLine", () => {
  it("shows the entered expense currency instead of the converted group currency", () => {
    const t = (_key: string, params?: Record<string, string | number>) =>
      `${params?.payer ?? ""} paid ${params?.amount ?? ""}`;

    expect(payerLine(expense, t)).toBe("Alice paid 5000.00 NOK");
  });
});
