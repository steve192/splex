import { describe, expect, it } from "vitest";

import {
  hasBlockingOutstandingBalance,
  removeParticipantWarningKey,
} from "./removeParticipantDialogModel";

describe("hasBlockingOutstandingBalance", () => {
  it("requires at least one outstanding row and is suppressed for group deletion", () => {
    expect(
      hasBlockingOutstandingBalance({
        groupWillBeDeleted: false,
        outstanding: { owes: [], owed_by: [] },
      }),
    ).toBe(false);
    expect(
      hasBlockingOutstandingBalance({
        groupWillBeDeleted: false,
        outstanding: { owes: [{}], owed_by: [] },
      }),
    ).toBe(true);
    expect(
      hasBlockingOutstandingBalance({
        groupWillBeDeleted: true,
        outstanding: { owes: [{}], owed_by: [] },
      }),
    ).toBe(false);
  });
});

describe("removeParticipantWarningKey", () => {
  it("uses the auto-settlement warning for unregistered participants", () => {
    expect(removeParticipantWarningKey({ kind: "unregistered" })).toBe(
      "group.removeMember.outstandingWarning",
    );
    expect(removeParticipantWarningKey({ kind: "registered" })).toBe(
      "group.removeMember.convertWarning",
    );
    expect(removeParticipantWarningKey(null)).toBe(
      "group.removeMember.convertWarning",
    );
  });
});
