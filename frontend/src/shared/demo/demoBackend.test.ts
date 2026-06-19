import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined)
  }
}));

import { handleDemoRequest } from "./demoBackend";
import { DemoWriteBlockedError, onDemoWriteBlocked } from "./demoMode";

type DemoStatisticsResponse = {
  summary: {
    total_amount: string;
    expense_count: number;
    first_expense_date: string | null;
    last_expense_date: string | null;
    currency_breakdown: Array<{ currency: string; total: string; count: number }>;
  };
  monthly: Array<{ month: string; total: string }>;
};

describe("demoBackend GET", () => {
  it("returns the demo user for /api/me/", async () => {
    const user = await handleDemoRequest<{ email: string }>("GET", "/api/me/");
    expect(user.email).toBe("demo@splex.sterul.com");
  });

  it("returns groups list, then a specific group detail", async () => {
    const groups = await handleDemoRequest<Array<{ id: number; name: string; balance: string; archived_at: string | null }>>("GET", "/api/groups/");
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((group) => group.archived_at)).toBe(true);
    expect(groups[0].balance).toMatch(/^-?\d+\.\d{2}$/);
    const first = groups[0];
    const detail = await handleDemoRequest<{ id: number; participants: unknown[] }>(
      "GET",
      `/api/groups/${first.id}/`
    );
    expect(detail.id).toBe(first.id);
    expect(detail.participants.length).toBeGreaterThan(0);
  });

  it("returns ledger + balances + statistics for a group", async () => {
    const ledger = await handleDemoRequest<{ results: unknown[] }>(
      "GET",
      "/api/groups/1001/ledger/?offset=0&limit=30"
    );
    expect(Array.isArray(ledger.results)).toBe(true);
    const balances = await handleDemoRequest<unknown[]>("GET", "/api/groups/1001/balances/");
    expect(Array.isArray(balances)).toBe(true);
    const stats = await handleDemoRequest<{ summary: unknown }>("GET", "/api/groups/1001/statistics/");
    expect(stats.summary).toBeDefined();
  });

  it("keeps trip statistics chronologically ordered and currency-grouped", async () => {
    const stats = await handleDemoRequest<DemoStatisticsResponse>(
      "GET",
      "/api/groups/1001/statistics/"
    );

    expect(stats.summary).toMatchObject({
      total_amount: "685.00",
      expense_count: 6,
      first_expense_date: "2026-04-20",
      last_expense_date: "2026-05-22"
    });
    expect(stats.summary.currency_breakdown).toEqual([
      { currency: "EUR", total: "655.00", count: 5 },
      { currency: "USD", total: "32.40", count: 1 }
    ]);
    expect(stats.monthly).toHaveLength(12);
    expect(stats.monthly.at(-2)).toEqual({ month: "2026-04-01", total: "300.00" });
    expect(stats.monthly.at(-1)).toEqual({ month: "2026-05-01", total: "385.00" });
  });

  it("returns friends list and friend details", async () => {
    const friends = await handleDemoRequest<Array<{ id: number }>>("GET", "/api/friends/");
    expect(friends.length).toBeGreaterThan(0);
    const friend = await handleDemoRequest<{ id: number }>("GET", `/api/friends/${friends[0].id}/`);
    expect(friend.id).toBe(friends[0].id);
  });

  it("returns activity events", async () => {
    const activity = await handleDemoRequest<{ results: unknown[] }>(
      "GET",
      "/api/activity/?offset=0&limit=50"
    );
    expect(activity.results.length).toBeGreaterThan(0);
  });
});

describe("demoBackend writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks POST writes and notifies listener", async () => {
    const listener = vi.fn();
    const unsubscribe = onDemoWriteBlocked(listener);
    try {
      await expect(
        handleDemoRequest("POST", "/api/groups/1001/expenses/")
      ).rejects.toBeInstanceOf(DemoWriteBlockedError);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("blocks DELETE writes and notifies listener", async () => {
    const listener = vi.fn();
    const unsubscribe = onDemoWriteBlocked(listener);
    try {
      await expect(
        handleDemoRequest("DELETE", "/api/expenses/2001/")
      ).rejects.toBeInstanceOf(DemoWriteBlockedError);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("soft-allows benign POSTs (sync flush, logout) without notifying", async () => {
    const listener = vi.fn();
    const unsubscribe = onDemoWriteBlocked(listener);
    try {
      await handleDemoRequest("POST", "/api/auth/logout/");
      await handleDemoRequest("POST", "/api/sync/mutations/");
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
