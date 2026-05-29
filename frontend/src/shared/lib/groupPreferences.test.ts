import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    async getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    async setItem(key: string, value: string) {
      store[key] = value;
    }
  }
}));

import {
  loadSimplifyBalancesPreference,
  saveSimplifyBalancesPreference
} from "./groupPreferences";

describe("simplify balances preference", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("returns false when nothing has been saved yet", async () => {
    expect(await loadSimplifyBalancesPreference(42)).toBe(false);
  });

  it("returns true after saving true for that group id", async () => {
    await saveSimplifyBalancesPreference(42, true);
    expect(await loadSimplifyBalancesPreference(42)).toBe(true);
  });

  it("keeps preferences scoped per group id", async () => {
    await saveSimplifyBalancesPreference(1, true);
    await saveSimplifyBalancesPreference(2, false);
    expect(await loadSimplifyBalancesPreference(1)).toBe(true);
    expect(await loadSimplifyBalancesPreference(2)).toBe(false);
  });

  it("toggling back off persists the new value", async () => {
    await saveSimplifyBalancesPreference(7, true);
    await saveSimplifyBalancesPreference(7, false);
    expect(await loadSimplifyBalancesPreference(7)).toBe(false);
  });
});
