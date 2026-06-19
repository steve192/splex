import { describe, expect, it } from "vitest";

import { runBestEffortSequentially } from "./runBestEffortSequentially";

describe("runBestEffortSequentially", () => {
  it("does not start a step until the previous one resolves", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const first = () =>
      new Promise<void>((resolve) => {
        events.push("first:start");
        releaseFirst = () => {
          events.push("first:end");
          resolve();
        };
      });
    const second = () =>
      Promise.resolve().then(() => {
        events.push("second:start");
      });

    const pending = runBestEffortSequentially([first, second]);
    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await pending;
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("continues to later steps when an earlier one rejects", async () => {
    const ran: string[] = [];
    await runBestEffortSequentially([
      () => Promise.reject(new Error("permission unavailable")),
      () => {
        ran.push("location");
        return Promise.resolve();
      }
    ]);
    expect(ran).toEqual(["location"]);
  });
});
