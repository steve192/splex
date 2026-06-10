import { describe, expect, it } from "vitest";

import { subscriptionMatchesServerKey, urlBase64ToArrayBuffer } from "./webPush";

// P-256 public keys are 65 raw bytes; any base64url payload works for tests.
const KEY_A = "BEl1dGhlbnRpY190ZXN0X2tleV9B";
const KEY_B = "BEl1dGhlbnRpY190ZXN0X2tleV9C";

function subscriptionWithKey(key: ArrayBuffer | null) {
  return { options: { applicationServerKey: key } } as unknown as Pick<
    PushSubscription,
    "options"
  >;
}

describe("urlBase64ToArrayBuffer", () => {
  it("decodes url-safe base64 without padding", () => {
    const buffer = urlBase64ToArrayBuffer("AQID");
    expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3]);
  });
});

describe("subscriptionMatchesServerKey", () => {
  it("matches a subscription created with the same key", () => {
    const subscription = subscriptionWithKey(urlBase64ToArrayBuffer(KEY_A));
    expect(subscriptionMatchesServerKey(subscription, KEY_A)).toBe(true);
  });

  it("rejects a subscription created with a different key", () => {
    const subscription = subscriptionWithKey(urlBase64ToArrayBuffer(KEY_B));
    expect(subscriptionMatchesServerKey(subscription, KEY_A)).toBe(false);
  });

  it("rejects keys of different length", () => {
    const truncated = urlBase64ToArrayBuffer(KEY_A).slice(0, 8);
    expect(subscriptionMatchesServerKey(subscriptionWithKey(truncated), KEY_A)).toBe(false);
  });

  it("assumes a match when the browser does not expose the key", () => {
    expect(subscriptionMatchesServerKey(subscriptionWithKey(null), KEY_A)).toBe(true);
    expect(
      subscriptionMatchesServerKey({ options: undefined } as unknown as Pick<
        PushSubscription,
        "options"
      >, KEY_A)
    ).toBe(true);
  });
});
