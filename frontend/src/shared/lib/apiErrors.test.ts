import { describe, expect, it } from "vitest";

import { apiErrorMessage } from "./apiErrors";

const fallback = "fallback-text";
const t = (key: string) => (key === "common.error" ? fallback : key);

describe("apiErrorMessage", () => {
  it("returns the Error message when one is set", () => {
    expect(apiErrorMessage(new Error("backend rejected"), t)).toBe("backend rejected");
  });

  it("falls back to the translated generic message for an Error with no message", () => {
    expect(apiErrorMessage(new Error(""), t)).toBe(fallback);
  });

  it("falls back for non-Error throws (strings, undefined, plain objects)", () => {
    expect(apiErrorMessage("oops", t)).toBe(fallback);
    expect(apiErrorMessage(undefined, t)).toBe(fallback);
    expect(apiErrorMessage({ status: 500 }, t)).toBe(fallback);
  });
});
