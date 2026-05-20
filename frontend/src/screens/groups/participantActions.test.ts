import { describe, expect, it } from "vitest";

import { canRemoveParticipant } from "./participantActions";

describe("canRemoveParticipant", () => {
  it("hides the remove button for the current participant", () => {
    expect(canRemoveParticipant({ id: 7 }, 7)).toBe(false);
  });

  it("allows removing other participants", () => {
    expect(canRemoveParticipant({ id: 8 }, 7)).toBe(true);
  });

  it("defaults to allowing removal when the current participant id is unknown", () => {
    expect(canRemoveParticipant({ id: 7 }, null)).toBe(true);
    expect(canRemoveParticipant({ id: 7 }, undefined)).toBe(true);
  });
});
