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

  it("formats a non-ISO but parseable date string", () => {
    const value = formatDeviceDate("2026-05-18T10:00:00Z");
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toBe("2026-05-18T10:00:00Z");
  });

  it("falls back to today's parts when no value is given", () => {
    const parts = formatDeviceDateParts();
    expect(parts.month.length).toBeGreaterThan(0);
    expect(parts.day).toHaveLength(2);
  });

  it("falls back to today's parts for an unparseable value", () => {
    const parts = formatDeviceDateParts("not-a-date");
    expect(parts.month.length).toBeGreaterThan(0);
    expect(parts.day).toHaveLength(2);
  });

  it("parses an incomplete yyyy-mm-dd value via the date constructor", () => {
    // 0000-00-00 matches the ISO regex but year/month/day are falsy, so
    // dateFromDateOnly falls back to new Date(value).
    const parts = formatDeviceDateParts("0000-00-00");
    expect(parts.day).toHaveLength(2);
  });
});
