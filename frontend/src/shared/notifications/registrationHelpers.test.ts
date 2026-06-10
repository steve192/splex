import { describe, expect, it } from "vitest";

import {
  decideStartupPushRegistration,
  preferenceToPersistAfterStartup
} from "./registrationHelpers";

describe("decideStartupPushRegistration", () => {
  it("registers by default so the launch heartbeat keeps the backend token alive", () => {
    expect(decideStartupPushRegistration("unset", "undetermined")).toBe("register");
    expect(decideStartupPushRegistration("on", "granted")).toBe("register");
    expect(decideStartupPushRegistration("unset", "granted")).toBe("register");
  });

  it("respects an explicit per-device off across launches", () => {
    expect(decideStartupPushRegistration("off", "granted")).toBe("skip_disabled");
    expect(decideStartupPushRegistration("off", "undetermined")).toBe("skip_disabled");
    // Even with the permission denied, the explicit preference is the reason
    // reported, so the Account screen shows the toggle as off rather than a
    // permission problem.
    expect(decideStartupPushRegistration("off", "denied")).toBe("skip_disabled");
  });

  it("skips when the OS permission is permanently denied", () => {
    expect(decideStartupPushRegistration("unset", "denied")).toBe("skip_permission_denied");
    expect(decideStartupPushRegistration("on", "denied")).toBe("skip_permission_denied");
  });
});

describe("preferenceToPersistAfterStartup", () => {
  it("persists 'on' after a successful registration", () => {
    expect(preferenceToPersistAfterStartup("registered")).toBe("on");
  });

  it("persists nothing when registration did not succeed", () => {
    // A dismissed prompt or unsupported browser must not look like the user's
    // explicit Account-screen "off", which would suppress every future
    // startup registration.
    expect(preferenceToPersistAfterStartup("permission_denied")).toBeNull();
    expect(preferenceToPersistAfterStartup("unsupported")).toBeNull();
    expect(preferenceToPersistAfterStartup("error")).toBeNull();
    expect(preferenceToPersistAfterStartup("idle")).toBeNull();
  });
});
