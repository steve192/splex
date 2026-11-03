import { describe, expect, it } from "vitest";

import type { Expense } from "../../shared/types/models";
import {
  amountPaidFieldState,
  amountPaidFormValue,
  amountPaidNeedsReview,
  amountPaidPayload,
  amountPaidRate,
  isAmountPaidExpense,
  isAmountPaidInvalid,
  rateComparison,
} from "./amountPaidModel";

const amountPaidExpense: Expense = {
  id: 1,
  description: "Dinner",
  date: "2026-11-02",
  original_amount: "1250.00",
  original_currency: "NOK",
  converted_amount: "108.73",
  converted_currency: "EUR",
  exchange_rate: "0.08698400",
  exchange_rate_source: "manual",
  official_exchange_rate: "0.08570000",
  split_method: "exact",
  payments: [],
  owed: [],
};

describe("amountPaidFieldState", () => {
  it("is editable for a foreign-currency expense with one payer", () => {
    expect(
      amountPaidFieldState({
        currency: "NOK",
        contextCurrency: "EUR",
        multiPayer: false,
      }),
    ).toBe("editable");
  });

  it("explains the single-payer limit for several payers", () => {
    expect(
      amountPaidFieldState({
        currency: "NOK",
        contextCurrency: "EUR",
        multiPayer: true,
      }),
    ).toBe("singlePayerOnly");
  });

  it("is hidden without a foreign currency or a known context", () => {
    expect(
      amountPaidFieldState({
        currency: "EUR",
        contextCurrency: "EUR",
        multiPayer: false,
      }),
    ).toBe("hidden");
    expect(
      amountPaidFieldState({
        currency: "NOK",
        contextCurrency: null,
        multiPayer: false,
      }),
    ).toBe("hidden");
  });
});

describe("amountPaidPayload", () => {
  it("sends the normalized amount only while the field is editable", () => {
    expect(amountPaidPayload("editable", " 108,73 ")).toBe("108.73");
    expect(amountPaidPayload("editable", "")).toBeNull();
    expect(amountPaidPayload("singlePayerOnly", "108.73")).toBeNull();
    expect(amountPaidPayload("hidden", "108.73")).toBeNull();
  });
});

describe("isAmountPaidInvalid", () => {
  it("rejects a non-positive amount paid that would be sent", () => {
    expect(isAmountPaidInvalid("editable", "0")).toBe(true);
    expect(isAmountPaidInvalid("editable", ".")).toBe(true);
    expect(isAmountPaidInvalid("editable", "108.73")).toBe(false);
    expect(isAmountPaidInvalid("editable", "")).toBe(false);
    expect(isAmountPaidInvalid("hidden", "0")).toBe(false);
  });
});

describe("amountPaidFormValue", () => {
  it("prefills only amounts that were entered as amount paid", () => {
    expect(isAmountPaidExpense(amountPaidExpense)).toBe(true);
    expect(amountPaidFormValue(amountPaidExpense)).toBe("108.73");
    expect(
      amountPaidFormValue({
        ...amountPaidExpense,
        exchange_rate_source: "frankfurter",
      }),
    ).toBe("");
  });
});

describe("amountPaidRate", () => {
  it("derives the rate from receipt amount and amount paid", () => {
    expect(amountPaidRate("1250", "108.73")).toBeCloseTo(0.086984);
    expect(amountPaidRate("1250", "")).toBeNull();
    expect(amountPaidRate("0", "108.73")).toBeNull();
  });
});

describe("amountPaidNeedsReview", () => {
  it("asks for a review when only the receipt amount changed", () => {
    expect(
      amountPaidNeedsReview({
        loadedExpense: amountPaidExpense,
        amount: "1300",
        amountPaid: "108.73",
      }),
    ).toBe(true);
  });

  it("stays quiet when the amount paid was updated too or nothing changed", () => {
    expect(
      amountPaidNeedsReview({
        loadedExpense: amountPaidExpense,
        amount: "1300",
        amountPaid: "113.10",
      }),
    ).toBe(false);
    expect(
      amountPaidNeedsReview({
        loadedExpense: amountPaidExpense,
        amount: "1250.00",
        amountPaid: "108.73",
      }),
    ).toBe(false);
    expect(
      amountPaidNeedsReview({
        loadedExpense: null,
        amount: "1300",
        amountPaid: "108.73",
      }),
    ).toBe(false);
  });
});

describe("rateComparison", () => {
  it("describes a rate above the official rate", () => {
    expect(rateComparison(0.1015, 0.1, "en")).toEqual({
      key: "expense.rateAboveOfficial",
      percent: "1.5%",
      suspicious: false,
    });
  });

  it("describes a rate below the official rate", () => {
    expect(rateComparison(0.098, 0.1, "en").key).toBe(
      "expense.rateBelowOfficial",
    );
  });

  it("treats deviations that round to 0% as matching", () => {
    expect(rateComparison(0.10004, 0.1, "en").key).toBe(
      "expense.rateMatchesOfficial",
    );
  });

  it("flags deviations beyond 10% as suspicious", () => {
    expect(rateComparison(0.87, 0.0857, "en").suspicious).toBe(true);
    expect(rateComparison(0.109, 0.1, "en").suspicious).toBe(false);
  });
});
