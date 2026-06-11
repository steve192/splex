import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    async getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    async setItem(key: string, value: string) {
      store[key] = value;
    },
    async removeItem(key: string) {
      delete store[key];
    }
  }
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { PendingMutation } from "../sync/queue";
import {
  countPendingExpensesByContext,
  listPendingExpenses,
  pendingExpenseContextKey,
  pendingExpensesForContext,
  removePendingExpense
} from "./pendingExpenses";

const QUEUE_KEY = "splex.pendingMutations";

function seed(mutations: PendingMutation[]) {
  store[QUEUE_KEY] = JSON.stringify(mutations);
}

function expenseMutation(
  id: string,
  contextType: "group" | "friendship",
  contextId: number,
  createdAt: string,
  expense: Record<string, unknown> = {}
): PendingMutation {
  return {
    id,
    type: "create_expense",
    payload: { context_type: contextType, context_id: contextId, expense },
    createdAt,
    status: "pending"
  };
}

describe("pendingExpenseContextKey", () => {
  it("joins context type and id", () => {
    expect(pendingExpenseContextKey("group", 5)).toBe("group:5");
  });
});

describe("listPendingExpenses", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("returns an empty list when nothing is queued", async () => {
    expect(await listPendingExpenses()).toEqual([]);
  });

  it("parses, applies defaults, and sorts newest first", async () => {
    seed([
      expenseMutation("old", "group", 1, "2026-01-01T00:00:00.000Z", {
        description: "Lunch",
        amount: "12.50",
        currency: "USD",
        date: "2026-01-01"
      }),
      expenseMutation("new", "friendship", 2, "2026-02-01T00:00:00.000Z")
    ]);

    const drafts = await listPendingExpenses();

    expect(drafts.map((d) => d.mutationId)).toEqual(["new", "old"]);
    // defaults applied when the expense payload is empty
    expect(drafts[0]).toMatchObject({ description: "", amount: "0", currency: "EUR" });
    expect(drafts[0].date).toBe(drafts[0].createdAt);
    // explicit fields are preserved
    expect(drafts[1]).toMatchObject({ description: "Lunch", amount: "12.50", currency: "USD" });
  });

  it("skips malformed or non-expense mutations", async () => {
    seed([
      { id: "x", type: "create_expense", payload: {}, createdAt: "2026-01-01", status: "pending" },
      {
        id: "y",
        type: "other" as never,
        payload: { context_type: "group", context_id: 1 },
        createdAt: "2026-01-02",
        status: "pending"
      },
      expenseMutation("z", "group", 9, "2026-01-03")
    ]);

    const drafts = await listPendingExpenses();
    expect(drafts.map((d) => d.mutationId)).toEqual(["z"]);
  });
});

describe("countPendingExpensesByContext", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("counts drafts grouped by context key", async () => {
    seed([
      expenseMutation("a", "group", 1, "2026-01-01"),
      expenseMutation("b", "group", 1, "2026-01-02"),
      expenseMutation("c", "friendship", 7, "2026-01-03")
    ]);

    expect(await countPendingExpensesByContext()).toEqual({ "group:1": 2, "friendship:7": 1 });
  });
});

describe("pendingExpensesForContext", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("returns only mutations matching the given context", async () => {
    seed([
      expenseMutation("a", "group", 1, "2026-01-01"),
      expenseMutation("b", "friendship", 1, "2026-01-02"),
      expenseMutation("c", "group", 2, "2026-01-03")
    ]);

    const rows = await pendingExpensesForContext("group", 1);
    expect(rows.map((m) => m.id)).toEqual(["a"]);
  });
});

describe("removePendingExpense", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("drops the mutation from the queue", async () => {
    seed([
      expenseMutation("a", "group", 1, "2026-01-01"),
      expenseMutation("b", "group", 1, "2026-01-02")
    ]);

    await removePendingExpense("a");

    expect((await listPendingExpenses()).map((d) => d.mutationId)).toEqual(["b"]);
  });
});
