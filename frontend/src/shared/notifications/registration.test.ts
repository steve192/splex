import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    })
  }
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" }
}));

vi.mock("../lib/serviceWorker", () => ({ ensureServiceWorkerRegistration: vi.fn() }));
vi.mock("../lib/webPush", () => ({ urlBase64ToArrayBuffer: vi.fn() }));

import { getLocalPushPreference } from "./registration";

const LOCAL_PREF_KEY = "splex.push.devicePreference";

describe("getLocalPushPreference", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("returns 'unset' when nothing stored", async () => {
    expect(await getLocalPushPreference()).toBe("unset");
  });

  it("returns 'on' when stored as 'on'", async () => {
    storage.set(LOCAL_PREF_KEY, "on");
    expect(await getLocalPushPreference()).toBe("on");
  });

  it("returns 'off' when stored as 'off'", async () => {
    storage.set(LOCAL_PREF_KEY, "off");
    expect(await getLocalPushPreference()).toBe("off");
  });

  it("returns 'unset' for any unexpected stored value", async () => {
    storage.set(LOCAL_PREF_KEY, "true");
    expect(await getLocalPushPreference()).toBe("unset");
  });
});
