import { describe, expect, it, vi } from "vitest";

vi.mock("expo-location", () => ({
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
}));

import * as Location from "expo-location";

import {
  browserPermissionStateToLocationState,
  expoPermissionStatusToLocationState,
} from "./locationPermissionModel";

describe("browserPermissionStateToLocationState", () => {
  it("maps browser permission states onto the app permission model", () => {
    expect(browserPermissionStateToLocationState("granted")).toBe("granted");
    expect(browserPermissionStateToLocationState("denied")).toBe("denied");
    expect(browserPermissionStateToLocationState("prompt")).toBe(
      "undetermined",
    );
    expect(browserPermissionStateToLocationState("unsupported")).toBe("denied");
  });
});

describe("expoPermissionStatusToLocationState", () => {
  it("maps Expo permission states onto the app permission model", () => {
    expect(
      expoPermissionStatusToLocationState(Location.PermissionStatus.GRANTED),
    ).toBe("granted");
    expect(
      expoPermissionStatusToLocationState(Location.PermissionStatus.DENIED),
    ).toBe("denied");
    expect(
      expoPermissionStatusToLocationState(
        Location.PermissionStatus.UNDETERMINED,
      ),
    ).toBe("undetermined");
  });
});
