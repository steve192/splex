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

import { PendingMutation, syncPendingMutations } from "./queue";

function mutation(id: string, overrides: Partial<PendingMutation> = {}): PendingMutation {
  return {
    id,
    type: "create_expense",
    payload: { foo: "bar" },
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    ...overrides
  };
}

describe("syncPendingMutations", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("starts empty", async () => {
    expect(await syncPendingMutations.list()).toEqual([]);
    expect(await syncPendingMutations.get("missing")).toBeNull();
  });

  it("enqueues and reads back mutations", async () => {
    await syncPendingMutations.enqueue(mutation("a"));
    await syncPendingMutations.enqueue(mutation("b"));
    const list = await syncPendingMutations.list();
    expect(list.map((m) => m.id)).toEqual(["a", "b"]);
    expect(await syncPendingMutations.get("b")).toMatchObject({ id: "b" });
  });

  it("enqueue replaces an existing mutation with the same id (no duplicates)", async () => {
    await syncPendingMutations.enqueue(mutation("a", { status: "pending" }));
    await syncPendingMutations.enqueue(mutation("a", { status: "failed" }));
    const list = await syncPendingMutations.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("failed");
  });

  it("removes a mutation by id", async () => {
    await syncPendingMutations.enqueue(mutation("a"));
    await syncPendingMutations.enqueue(mutation("b"));
    await syncPendingMutations.remove("a");
    expect((await syncPendingMutations.list()).map((m) => m.id)).toEqual(["b"]);
  });

  it("flush posts every mutation and clears the queue on success", async () => {
    await syncPendingMutations.enqueue(mutation("a"));
    await syncPendingMutations.enqueue(mutation("b"));
    const post = vi.fn().mockResolvedValue(undefined);

    await syncPendingMutations.flush({ post } as never);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith("/api/sync/mutations/", {
      clientMutationId: "a",
      type: "create_expense",
      payload: { foo: "bar" }
    });
    expect(await syncPendingMutations.list()).toEqual([]);
  });

  it("flush keeps failed mutations and records the error message", async () => {
    await syncPendingMutations.enqueue(mutation("ok"));
    await syncPendingMutations.enqueue(mutation("bad"));
    const post = vi.fn(async (_path: string, body: { clientMutationId: string }) => {
      if (body.clientMutationId === "bad") throw new Error("network down");
    });

    await syncPendingMutations.flush({ post } as never);

    const remaining = await syncPendingMutations.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      id: "bad",
      status: "failed",
      lastError: { message: "network down" }
    });
  });

  it("does not persist arbitrary non-Error throwables as user-facing text", async () => {
    await syncPendingMutations.enqueue(mutation("bad"));
    const post = vi.fn().mockRejectedValue("boom");

    await syncPendingMutations.flush({ post } as never);

    expect((await syncPendingMutations.list())[0].lastError).toEqual({});
  });
});
