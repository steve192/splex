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

import {
  DEMO_MODE_STORAGE_KEY,
  DemoWriteBlockedError,
  loadPersistedDemoMode,
  notifyDemoWriteBlocked,
  onDemoWriteBlocked,
  persistDemoMode
} from "./demoMode";

describe("demo mode persistence", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("defaults to disabled when nothing is stored", async () => {
    expect(await loadPersistedDemoMode()).toBe(false);
  });

  it("persists and reads back the enabled flag", async () => {
    await persistDemoMode(true);
    expect(store[DEMO_MODE_STORAGE_KEY]).toBe("1");
    expect(await loadPersistedDemoMode()).toBe(true);
  });

  it("clears the flag when disabled", async () => {
    await persistDemoMode(true);
    await persistDemoMode(false);
    expect(store[DEMO_MODE_STORAGE_KEY]).toBeUndefined();
    expect(await loadPersistedDemoMode()).toBe(false);
  });
});

describe("demo write-blocked notifications", () => {
  it("notifies subscribed listeners and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = onDemoWriteBlocked(listener);

    notifyDemoWriteBlocked();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyDemoWriteBlocked();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("DemoWriteBlockedError carries a stable name and message", () => {
    const error = new DemoWriteBlockedError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DemoWriteBlockedError");
    expect(error.message).toContain("read-only");
  });
});
