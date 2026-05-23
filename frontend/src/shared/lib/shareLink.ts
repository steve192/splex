import { Platform, Share } from "react-native";

import { copyTextToClipboard } from "./clipboard";

export type ShareLinkResult = "shared" | "copied" | "failed";

interface ShareLinkOptions {
  /** Used as the OS share-sheet title and as the navigator.share() title on web. */
  title?: string;
}

/**
 * Share a link via the OS share sheet on native, or fall back to clipboard.
 *
 * On Android/iOS: opens the system share sheet so the user can pick a target
 * app (messages, email, chat) instead of forcing them to copy + paste.
 *
 * On web: uses navigator.share when available (most mobile browsers and PWAs),
 * otherwise copies to clipboard.
 *
 * Returns "shared" when the share sheet was displayed (we don't know what the
 * user picked, that's OS-private), "copied" when the link landed on the
 * clipboard, and "failed" when no mechanism worked - callers should then fall
 * back to a manual-copy dialog.
 */
export async function shareLink(url: string, opts: ShareLinkOptions = {}): Promise<ShareLinkResult> {
  if (!url) return "failed";

  if (Platform.OS === "android" || Platform.OS === "ios") {
    try {
      await Share.share({ message: url, ...(opts.title ? { title: opts.title } : {}) });
      return "shared";
    } catch {
      // Fall through to clipboard if the share sheet failed to open.
    }
  } else if (Platform.OS === "web" && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ url, ...(opts.title ? { title: opts.title } : {}) });
      return "shared";
    } catch {
      // navigator.share rejects on user cancel; fall through to clipboard so
      // the user still has the link available if they want it.
    }
  }

  return (await copyTextToClipboard(url)) ? "copied" : "failed";
}
