import { describe, expect, it } from "vitest";

import { expenseDetailViewState, expenseEditViewState } from "./expenseLoading";

describe("expenseDetailViewState", () => {
  it("shows loading until the detail expense is available", () => {
    expect(expenseDetailViewState({ loading: true, hasExpense: false, loadFailed: false })).toBe("loading");
  });

  it("shows content once the detail expense has loaded", () => {
    expect(expenseDetailViewState({ loading: false, hasExpense: true, loadFailed: false })).toBe("content");
  });

  it("shows an error instead of an empty detail screen after load failure", () => {
    expect(expenseDetailViewState({ loading: false, hasExpense: false, loadFailed: true })).toBe("error");
  });
});

describe("expenseEditViewState", () => {
  it("shows content immediately for a new expense form", () => {
    expect(expenseEditViewState({ editing: false, loading: false, loadFailed: false })).toBe("content");
  });

  it("keeps edit fields hidden while the existing expense is hydrating", () => {
    expect(expenseEditViewState({ editing: true, loading: true, loadFailed: false })).toBe("loading");
  });

  it("shows an error instead of empty edit fields after load failure", () => {
    expect(expenseEditViewState({ editing: true, loading: false, loadFailed: true })).toBe("error");
  });
});
