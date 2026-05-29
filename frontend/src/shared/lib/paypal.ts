import { PaymentMethod } from "../types/models";

/** Append the amount/currency to a paypal.me URL so the PayPal page opens
 * with the value pre-filled.  Returns the original URL unchanged for any
 * other PayPal method (e.g. email-based ones use the generic send-money
 * page, which has no amount slot we can encode), and for invalid/empty
 * amounts (we'd rather open the bare profile than a malformed link).
 */
export function payUrlWithAmount(
  method: PaymentMethod,
  amount: string,
  currency: string
): string {
  if (!method.pre_fills_recipient) return method.url;
  const normalized = amount.trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return method.url;
  const safeAmount = parsed.toFixed(2);
  const safeCurrency = currency.trim().toUpperCase();
  return safeCurrency
    ? `${method.url}/${safeAmount}${safeCurrency}`
    : `${method.url}/${safeAmount}`;
}
