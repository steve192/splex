import { describe, expect, it } from "vitest";

import { payUrlWithAmount } from "./paypal";
import { PaymentMethod } from "../types/models";

function handle(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: 1,
    kind: "paypal_handle",
    identifier: "alice",
    is_preferred: true,
    display: "paypal.me/alice",
    url: "https://paypal.me/alice",
    pre_fills_recipient: true,
    ...overrides
  };
}

function email(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: 2,
    kind: "paypal_email",
    identifier: "alice@example.com",
    is_preferred: true,
    display: "alice@example.com",
    url: "https://www.paypal.com/myaccount/transfer/homepage/pay",
    pre_fills_recipient: false,
    ...overrides
  };
}

describe("payUrlWithAmount", () => {
  it("appends amount and currency for paypal.me handles", () => {
    expect(payUrlWithAmount(handle(), "12.5", "EUR")).toBe(
      "https://paypal.me/alice/12.50EUR"
    );
  });

  it("uppercases the currency when appending", () => {
    expect(payUrlWithAmount(handle(), "12.50", "eur")).toBe(
      "https://paypal.me/alice/12.50EUR"
    );
  });

  it("accepts comma decimal separators", () => {
    expect(payUrlWithAmount(handle(), "12,50", "EUR")).toBe(
      "https://paypal.me/alice/12.50EUR"
    );
  });

  it("rounds to two decimals", () => {
    expect(payUrlWithAmount(handle(), "12.499", "EUR")).toBe(
      "https://paypal.me/alice/12.50EUR"
    );
  });

  it("returns the bare URL for non-positive or invalid amounts", () => {
    const bare = handle();
    expect(payUrlWithAmount(bare, "", "EUR")).toBe(bare.url);
    expect(payUrlWithAmount(bare, "0", "EUR")).toBe(bare.url);
    expect(payUrlWithAmount(bare, "-5", "EUR")).toBe(bare.url);
    expect(payUrlWithAmount(bare, "abc", "EUR")).toBe(bare.url);
  });

  it("returns the unchanged URL for email-based methods even with a valid amount", () => {
    const e = email();
    expect(payUrlWithAmount(e, "12.50", "EUR")).toBe(e.url);
  });

  it("falls back gracefully when currency is blank", () => {
    expect(payUrlWithAmount(handle(), "12.50", "")).toBe(
      "https://paypal.me/alice/12.50"
    );
  });
});
