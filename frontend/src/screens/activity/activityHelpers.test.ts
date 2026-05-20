import { describe, expect, it } from "vitest";

import { ActivityFeedEvent } from "../../shared/types/models";
import { activityContext, activityDescription, activityIcon } from "./activityHelpers";

function fakeT(key: string, params?: Record<string, string | number>): string {
  if (!params) return key;
  const formatted = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `${key}|${formatted}`;
}

function event(overrides: Partial<ActivityFeedEvent>): ActivityFeedEvent {
  return {
    id: 1,
    event_type: "expense.created",
    actor: "Alice",
    created_at: "2026-05-20T10:00:00Z",
    ...overrides
  };
}

describe("activityDescription", () => {
  it("formats expense with description + amount + currency", () => {
    const out = activityDescription(
      event({ payload: { description: "Pizza", amount: "10.00", currency: "EUR" } }),
      fakeT
    );
    expect(out).toBe("Pizza - 10.00 EUR");
  });

  it("returns just the description when amount is missing", () => {
    const out = activityDescription(event({ payload: { description: "Coffee" } }), fakeT);
    expect(out).toBe("Coffee");
  });

  it("renders settlement line via i18n template", () => {
    const out = activityDescription(
      event({
        event_type: "settlement.created",
        payload: { fromName: "Alice", toName: "Bob", amount: "10.00", currency: "EUR" }
      }),
      fakeT
    );
    expect(out).toContain("settlement.line");
    expect(out).toContain("from=Alice");
    expect(out).toContain("to=Bob");
    expect(out).toContain("amount=10.00 EUR");
  });

  it("prefers subject_name over legacy payload snapshots", () => {
    const out = activityDescription(
      event({
        event_type: "group.member_added",
        subject_name: "LiveName",
        payload: { participantName: "StaleName" }
      }),
      fakeT
    );
    expect(out).toBe("LiveName");
  });

  it("falls back to legacy participantName when no subject_name", () => {
    const out = activityDescription(
      event({
        event_type: "group.member_added",
        payload: { participantName: "LegacyBob" }
      }),
      fakeT
    );
    expect(out).toBe("LegacyBob");
  });

  it("falls back to amount+currency when nothing else is present", () => {
    const out = activityDescription(
      event({ event_type: "settlement.updated", payload: { amount: "5.00", currency: "USD" } }),
      fakeT
    );
    expect(out).toBe("5.00 USD");
  });

  it("returns empty string when no useful payload", () => {
    const out = activityDescription(event({ payload: {} }), fakeT);
    expect(out).toBe("");
  });
});

describe("activityContext", () => {
  it("prefixes group context with localized label", () => {
    const out = activityContext(event({ context_type: "group", context_name: "Trip" }), fakeT);
    expect(out).toBe("group.title: Trip");
  });

  it("prefixes friend context with localized label", () => {
    const out = activityContext(event({ context_type: "friend", context_name: "Bob" }), fakeT);
    expect(out).toBe("friend.title: Bob");
  });

  it("returns plain context_name when type is empty", () => {
    const out = activityContext(event({ context_type: "", context_name: "Other" }), fakeT);
    expect(out).toBe("Other");
  });

  it("returns empty string when context_name is missing", () => {
    expect(activityContext(event({}), fakeT)).toBe("");
  });
});

describe("activityIcon", () => {
  it.each([
    ["expense.created", "receipt"],
    ["expense.deleted", "receipt"],
    ["settlement.created", "cash-check"],
    ["friend.invited", "account"],
    ["group.member_added", "account-group"],
    ["invitation.accepted", "history"]
  ])("maps %s to %s", (eventType, icon) => {
    expect(activityIcon(eventType)).toBe(icon);
  });
});
