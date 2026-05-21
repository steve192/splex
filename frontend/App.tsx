import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";

import { AppShell } from "./src/application/AppShell";
import { ensureServiceWorkerRegistration } from "./src/shared/lib/serviceWorker";

// Must run at module load time — when this app is loaded inside the OAuth
// popup, this call detects the callback URL, posts the result to the opener
// window, and closes the popup before any UI renders.
WebBrowser.maybeCompleteAuthSession();

export default function App() {
  useEffect(() => {
    ensureServiceWorkerRegistration().catch(() => undefined);
  }, []);

  return <AppShell />;
}
