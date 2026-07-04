import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import { ApiError } from "../../shared/api/client";
import {
  draftClientIdForExpenseForm,
  expenseCollectionPath,
  pendingExpenseMutation,
  shouldQueueOfflineCreate,
  type ExpenseSavePayload,
} from "./addScreenSaveModel";

const payload: ExpenseSavePayload = {
  context_type: "group",
  context_id: 1,
  expense: {
    client_id: "client-1",
    description: "Lunch",
  },
};

describe("expenseCollectionPath", () => {
  it("builds the collection endpoint for group and friendship contexts", () => {
    expect(expenseCollectionPath("group", 7)).toBe("/api/groups/7/expenses/");
    expect(expenseCollectionPath("friendship", 9)).toBe(
      "/api/friends/9/expenses/",
    );
  });
});

describe("draftClientIdForExpenseForm", () => {
  it("keeps pending mutation ids but creates a fresh id for each create draft", () => {
    let nextId = 1;
    const createId = vi.fn(() => `new-${nextId++}`);

    expect(
      draftClientIdForExpenseForm({
        pendingMutationId: "pending-1",
        createId,
      }),
    ).toBe("pending-1");
    expect(draftClientIdForExpenseForm({ createId })).toBe("new-1");
    expect(
      draftClientIdForExpenseForm({ pendingMutationId: " ", createId }),
    ).toBe("new-2");
    expect(createId).toHaveBeenCalledTimes(2);
  });
});

describe("pendingExpenseMutation", () => {
  it("creates the queue mutation shape used by offline expense creation", () => {
    expect(
      pendingExpenseMutation({
        id: "pending-1",
        payload,
        createdAt: "2026-06-26T10:00:00.000Z",
      }),
    ).toEqual({
      id: "pending-1",
      type: "create_expense",
      payload,
      createdAt: "2026-06-26T10:00:00.000Z",
      status: "pending",
    });
  });
});

describe("shouldQueueOfflineCreate", () => {
  it("queues only offline create failures", () => {
    const offlineError = new ApiError("offline", { offline: true });

    expect(shouldQueueOfflineCreate(offlineError, undefined)).toBe(true);
    expect(shouldQueueOfflineCreate(offlineError, 1)).toBe(false);
    expect(shouldQueueOfflineCreate(new Error("boom"), undefined)).toBe(false);
  });
});
