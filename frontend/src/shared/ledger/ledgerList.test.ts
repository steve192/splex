import { describe, expect, it } from "vitest";

import { ledgerEmptyStateKey } from "./ledgerListState";

describe("ledgerEmptyStateKey", () => {
  it("uses the no-results copy while searching an empty ledger", () => {
    expect(
      ledgerEmptyStateKey({
        hasPending: false,
        itemCount: 0,
        loadingInitial: false,
        searching: true
      })
    ).toBe("common.noResults");
  });

  it("uses the empty expense copy for an idle empty ledger", () => {
    expect(
      ledgerEmptyStateKey({
        hasPending: false,
        itemCount: 0,
        loadingInitial: false,
        searching: false
      })
    ).toBe("expense.empty");
  });

  it("hides the empty state when ledger content or pending content exists", () => {
    expect(
      ledgerEmptyStateKey({
        hasPending: false,
        itemCount: 1,
        loadingInitial: false,
        searching: false
      })
    ).toBeNull();
    expect(
      ledgerEmptyStateKey({
        hasPending: true,
        itemCount: 0,
        loadingInitial: false,
        searching: false
      })
    ).toBeNull();
  });
});
