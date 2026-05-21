// Web-only Google OAuth helpers using a full-page redirect (no popup, no
// iframes).  Popups / GIS iframes fall over too easily on self-hosted setups:
// COOP strips window.opener, service workers serve stale shells, and Chrome's
// Private Network Access blocks the embedded fetches when the host resolves
// to a LAN address.  A plain redirect avoids all of those.

const STATE_STORAGE_KEY = "splex.googleOAuthState";
const NONCE_STORAGE_KEY = "splex.googleOAuthNonce";

function randomHex(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Begin the Google OAuth redirect flow.  Stores a fresh state + nonce in
 * sessionStorage and navigates the current window to Google's auth endpoint.
 * The browser comes back to `window.location.origin` with the id_token in the
 * URL fragment.
 */
export function startGoogleOAuthRedirect(clientId: string): void {
  const state = randomHex(16);
  const nonce = randomHex(16);
  sessionStorage.setItem(STATE_STORAGE_KEY, state);
  sessionStorage.setItem(NONCE_STORAGE_KEY, nonce);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin,
    response_type: "id_token",
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * If the current URL is a Google OAuth callback, extract the id_token, verify
 * the returned state matches what we stored, scrub the fragment from the URL,
 * and return the token.  Returns null otherwise.
 */
export function consumeGoogleOAuthResponse(): { idToken: string } | null {
  if (typeof window === "undefined") return null;
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!rawHash.includes("id_token=")) return null;

  const params = new URLSearchParams(rawHash);
  const idToken = params.get("id_token");
  const returnedState = params.get("state");
  if (!idToken || !returnedState) return null;

  const storedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  if (!storedState || storedState !== returnedState) {
    // CSRF protection: state must match what we sent.  Clean up and bail.
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    sessionStorage.removeItem(NONCE_STORAGE_KEY);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return null;
  }

  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(NONCE_STORAGE_KEY);
  // Remove the OAuth fragment so a reload doesn't replay the login.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return { idToken };
}
