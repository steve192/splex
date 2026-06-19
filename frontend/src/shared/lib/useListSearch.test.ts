import { describe, expect, it } from "vitest";

import { canUseOnlineSearch } from "./useListSearch";

describe("canUseOnlineSearch", () => {
  it("blocks search when the device is known to be offline", () => {
    expect(canUseOnlineSearch({ isConnected: false, isInternetReachable: true })).toBe(false);
    expect(canUseOnlineSearch({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it("allows search while online or while reachability is still unknown", () => {
    expect(canUseOnlineSearch({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(canUseOnlineSearch({ isConnected: null, isInternetReachable: null })).toBe(true);
  });
});
