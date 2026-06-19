import { describe, expect, it } from "vitest";

import { snackbarStateForMessage } from "./snackbarLogic";

describe("snackbarStateForMessage", () => {
  it("uses the default duration when none is provided", () => {
    expect(snackbarStateForMessage("Saved")).toEqual({
      message: "Saved",
      duration: 6000,
    });
  });

  it("keeps a caller-provided duration", () => {
    expect(snackbarStateForMessage("Copied", { duration: 8000 })).toEqual({
      message: "Copied",
      duration: 8000,
    });
  });
});
