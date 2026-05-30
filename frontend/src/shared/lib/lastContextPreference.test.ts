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
  loadRememberContextPreference,
  saveRememberContextPreference
} from "./lastContextPreference";

describe("remember context preference", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("defaults to not remembering with no context", async () => {
    expect(await loadRememberContextPreference()).toEqual({ remember: false, context: null });
  });

  it("persists the remembered context when enabled", async () => {
    await saveRememberContextPreference({ remember: true, context: { type: "group", id: 5 } });
    expect(await loadRememberContextPreference()).toEqual({
      remember: true,
      context: { type: "group", id: 5 }
    });
  });

  it("clears the stored context when disabled", async () => {
    await saveRememberContextPreference({ remember: true, context: { type: "friendship", id: 9 } });
    await saveRememberContextPreference({ remember: false, context: null });
    expect(await loadRememberContextPreference()).toEqual({ remember: false, context: null });
  });

  it("remembers being enabled even before a context is picked", async () => {
    await saveRememberContextPreference({ remember: true, context: null });
    expect(await loadRememberContextPreference()).toEqual({ remember: true, context: null });
  });

  it("ignores malformed stored context", async () => {
    store["splex.add.rememberContext"] = "true";
    store["splex.add.lastContext"] = "{not json";
    expect(await loadRememberContextPreference()).toEqual({ remember: true, context: null });
  });
});
