import { describe, expect, it } from "vitest";

import { apiErrorMessage, apiWriteErrorMessage } from "./apiErrors";

const fallback = "fallback-text";
const writeOffline = "write-offline-text";
const t = (key: string) => {
  if (key === "common.error") return fallback;
  if (key === "write.offline") return writeOffline;
  return key;
};

describe("apiErrorMessage", () => {
  it("returns the Error message when one is set", () => {
    expect(apiErrorMessage(new Error("backend rejected"), t)).toBe(
      "backend rejected",
    );
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

describe("apiWriteErrorMessage", () => {
  it("uses a translated bad-connection message for offline write failures", () => {
    const error = Object.assign(new Error("Network unavailable"), {
      offline: true,
    });
    expect(apiWriteErrorMessage(error, t)).toBe(writeOffline);
  });

  it("preserves backend write validation messages when the request reached the server", () => {
    expect(apiWriteErrorMessage(new Error("Name is required"), t)).toBe(
      "Name is required",
    );
  });
});
