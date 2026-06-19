import { describe, expect, it } from "vitest";

import {
  decideLoginPushRegistration,
  preferenceToPersistAfterLogin
} from "./registrationHelpers";

describe("decideLoginPushRegistration", () => {
  it("registers by default so a fresh login enables this device", () => {
    expect(decideLoginPushRegistration("unset", "undetermined")).toBe("register");
    expect(decideLoginPushRegistration("on", "granted")).toBe("register");
    expect(decideLoginPushRegistration("unset", "granted")).toBe("register");
  });

  it("respects an explicit per-device off across launches", () => {
    expect(decideLoginPushRegistration("off", "granted")).toBe("skip_disabled");
    expect(decideLoginPushRegistration("off", "undetermined")).toBe("skip_disabled");
    // Even with the permission denied, the explicit preference is the reason
    // reported, so the Account screen shows the toggle as off rather than a
    // permission problem.
    expect(decideLoginPushRegistration("off", "denied")).toBe("skip_disabled");
  });

  it("skips when the OS permission is permanently denied", () => {
    expect(decideLoginPushRegistration("unset", "denied")).toBe("skip_permission_denied");
    expect(decideLoginPushRegistration("on", "denied")).toBe("skip_permission_denied");
  });
});

describe("preferenceToPersistAfterLogin", () => {
  it("persists 'on' after a successful registration", () => {
    expect(preferenceToPersistAfterLogin("registered")).toBe("on");
  });

  it("persists nothing when registration did not succeed", () => {
    // A dismissed prompt or unsupported browser must not look like the user's
    // explicit Account-screen "off", which would suppress every future
    // login registration.
    expect(preferenceToPersistAfterLogin("permission_denied")).toBeNull();
    expect(preferenceToPersistAfterLogin("unsupported")).toBeNull();
    expect(preferenceToPersistAfterLogin("error")).toBeNull();
    expect(preferenceToPersistAfterLogin("idle")).toBeNull();
  });
});
