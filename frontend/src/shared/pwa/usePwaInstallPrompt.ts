import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Captures the browser's `beforeinstallprompt` event so we can trigger the
 * native install dialog from our own UI. The browser only fires this on
 * Chromium-based engines once the PWA install criteria are met (valid
 * manifest, registered service worker, served over HTTPS).
 *
 * Returns `null`-equivalents on native, on iOS Safari (no programmatic
 * prompt), and when the app is already running as an installed PWA.
 */

const DONT_ASK_KEY = "splex.pwa.dontAskAgain";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function detectStandalone(): boolean {
  if (Platform.OS !== "web" || globalThis.window === undefined) return false;
  if (globalThis.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes a non-standard `navigator.standalone` flag.
  return (globalThis.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIosSafari(): boolean {
  if (Platform.OS !== "web" || globalThis.window === undefined) return false;
  const ua = globalThis.navigator.userAgent;
  // iPadOS 13+ reports as Macintosh; touch points disambiguate.
  const isIpad =
    globalThis.navigator.platform === "MacIntel" && globalThis.navigator.maxTouchPoints > 1;
  const isIos = /iPad|iPhone|iPod/.test(ua) || isIpad;
  if (!isIos) return false;
  // Only Safari (and WKWebView shells) can Add to Home Screen on iOS - Chrome
  // iOS (CriOS), Firefox (FxiOS), Edge (EdgiOS) and Opera (OPiOS) cannot.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/**
 * How the user can install the PWA from here:
 * - `native`: Chromium / Edge / Samsung Internet - call `install()` to show
 *   the browser's built-in install dialog.
 * - `ios-safari`: iOS Safari - no programmatic API exists; the UI must show
 *   instructions for the Share → Add to Home Screen flow.
 */
export type PwaInstallMethod = "native" | "ios-safari";

export type PwaInstallPromptState = {
  /**
   * True when installation is technically possible right now. Use this for
   * explicit user-initiated entry points (e.g. a settings button) that should
   * bypass any prior "don't ask again" choice.
   */
  canInstall: boolean;
  /** How to install - drives whether `install()` works or instructions are needed. */
  installMethod: PwaInstallMethod | null;
  /**
   * True when the auto-shown banner should be visible: `canInstall` AND the
   * user hasn't dismissed it this session or asked us not to ask again.
   */
  available: boolean;
  /**
   * Trigger the browser's native install dialog (Chromium only). On iOS Safari
   * this resolves to "unavailable" - show iOS instructions instead.
   */
  install(): Promise<"accepted" | "dismissed" | "unavailable">;
  /** Hide the auto-shown banner for the current session only. */
  dismiss(): void;
  /** Hide the auto-shown banner forever (persists across sessions). */
  dontAskAgain(): void;
};

export function usePwaInstallPrompt(): PwaInstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [persistentlyDismissed, setPersistentlyDismissed] = useState<boolean | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone);
  const [isIosSafari] = useState<boolean>(detectIosSafari);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setPersistentlyDismissed(true);
      return;
    }
    AsyncStorage.getItem(DONT_ASK_KEY)
      .then((stored) => setPersistentlyDismissed(stored === "1"))
      .catch(() => setPersistentlyDismissed(false));
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || globalThis.window === undefined) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    globalThis.addEventListener("beforeinstallprompt", handleBeforeInstall);
    globalThis.addEventListener("appinstalled", handleInstalled);
    return () => {
      globalThis.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      globalThis.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    // The captured event is single-use; clear it regardless of outcome.
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => setSessionDismissed(true), []);

  const dontAskAgain = useCallback(() => {
    setSessionDismissed(true);
    setPersistentlyDismissed(true);
    AsyncStorage.setItem(DONT_ASK_KEY, "1").catch(() => undefined);
  }, []);

  let installMethod: PwaInstallMethod | null = null;
  if (Platform.OS === "web" && !isStandalone) {
    if (deferredPrompt !== null) installMethod = "native";
    else if (isIosSafari) installMethod = "ios-safari";
  }

  const canInstall = installMethod !== null;

  const available =
    canInstall && !sessionDismissed && persistentlyDismissed === false;

  return { canInstall, installMethod, available, install, dismiss, dontAskAgain };
}
