/**
 * Whether an existing browser push subscription was created with the given
 * VAPID public key. A subscription made under a different key can never be
 * sent to by this server and must be replaced (unsubscribe + resubscribe).
 * Subscriptions that don't expose their key (older browsers) are assumed to
 * match, since replacing them on every login would churn endpoints.
 */
export function subscriptionMatchesServerKey(
  subscription: Pick<PushSubscription, "options">,
  vapidPublicKey: string
): boolean {
  const currentKey = subscription.options?.applicationServerKey;
  if (!currentKey) return true;
  const expected = new Uint8Array(urlBase64ToArrayBuffer(vapidPublicKey));
  const actual = new Uint8Array(currentKey);
  return actual.length === expected.length && expected.every((byte, index) => byte === actual[index]);
}

export function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}
