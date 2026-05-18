import { describe, expect, it } from "vitest";

import { formatDeviceDate, formatDeviceDateParts } from "./dates";

describe("date formatting", () => {
  it("returns empty string for missing date", () => {
    expect(formatDeviceDate()).toBe("");
  });

  it("keeps invalid values unchanged", () => {
    expect(formatDeviceDate("not-a-date")).toBe("not-a-date");
  });

  it("formats yyyy-mm-dd dates", () => {
    const value = formatDeviceDate("2026-05-18");
    expect(value.length).toBeGreaterThan(0);
  });

  it("returns month/day parts", () => {
    const parts = formatDeviceDateParts("2026-12-01");
    expect(parts.month.length).toBeGreaterThan(0);
    expect(parts.day).toHaveLength(2);
  });
});
