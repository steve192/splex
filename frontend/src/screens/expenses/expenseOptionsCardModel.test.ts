import { describe, expect, it } from "vitest";

import { expenseOptionRows } from "./expenseOptionsCardModel";

const t = (key: string) => `translated:${key}`;

describe("expenseOptionRows", () => {
  it("returns no rows until a context is selected", () => {
    expect(
      expenseOptionRows({
        hasContext: false,
        date: "",
        payerLabel: "Alice",
        splitLabel: "Equal",
        t,
      }),
    ).toEqual([]);
  });

  it("builds date, payer, and split rows with today's fallback", () => {
    expect(
      expenseOptionRows({
        hasContext: true,
        date: "",
        payerLabel: "Alice",
        splitLabel: "Equal",
        t,
      }),
    ).toEqual([
      {
        label: "translated:expense.date",
        value: "translated:common.today",
        sheet: "date",
      },
      { label: "translated:expense.paidBy", value: "Alice", sheet: "payer" },
      { label: "translated:expense.split", value: "Equal", sheet: "split" },
    ]);
  });
});
