import { describe, expect, it } from "vitest";

import {
  signedAmountLabel,
  statisticsEndpointWithRange,
  statisticsRangeForPeriod
} from "./statisticsModel";

describe("statisticsModel", () => {
  it("builds stable date ranges for built-in periods", () => {
    const today = new Date(2026, 5, 29);

    expect(statisticsRangeForPeriod("thisMonth", today)).toEqual({
      date_from: "2026-06-01",
      date_to: "2026-06-30"
    });
    expect(statisticsRangeForPeriod("lastMonth", today)).toEqual({
      date_from: "2026-05-01",
      date_to: "2026-05-31"
    });
    expect(statisticsRangeForPeriod("last12", today)).toEqual({
      date_from: "2025-07-01",
      date_to: "2026-06-29"
    });
  });

  it("adds query parameters only when a range is selected", () => {
    expect(statisticsEndpointWithRange("/api/groups/1/statistics/", {})).toBe(
      "/api/groups/1/statistics/"
    );
    expect(
      statisticsEndpointWithRange("/api/groups/1/statistics/", {
        date_from: "2026-01-01",
        date_to: "2026-01-31"
      })
    ).toBe("/api/groups/1/statistics/?date_from=2026-01-01&date_to=2026-01-31");
  });

  it("marks positive net amounts explicitly", () => {
    const formatter = (amount: string) => `${amount} EUR`;

    expect(signedAmountLabel("12.00", formatter)).toBe("+12.00 EUR");
    expect(signedAmountLabel("-5.00", formatter)).toBe("-5.00 EUR");
  });
});
