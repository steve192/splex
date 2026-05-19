import { useEffect } from "react";

import { AppShell } from "./src/application/AppShell";
import { ensureServiceWorkerRegistration } from "./src/shared/lib/serviceWorker";

export default function App() {
  useEffect(() => {
    ensureServiceWorkerRegistration().catch(() => undefined);
  }, []);

  return <AppShell />;
}
