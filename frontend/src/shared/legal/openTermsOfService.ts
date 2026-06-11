import { Platform } from "react-native";

import { addBasePath } from "../config/basePath";

export type LegalDocumentKind = "tos" | "privacy" | "imprint";

// Served by the SPA under the app base path (e.g. /app/tos). The landing footer
// links to these same routes so legal content is never duplicated.
const WEB_PATHS: Record<LegalDocumentKind, string> = {
  tos: addBasePath("/tos"),
  privacy: addBasePath("/privacy"),
  imprint: addBasePath("/imprint")
};

export function openLegalDocument(kind: LegalDocumentKind, openNativeScreen: () => void) {
  if (Platform.OS === "web" && globalThis.window !== undefined) {
    globalThis.window.open(new URL(WEB_PATHS[kind], globalThis.window.location.href).toString(), "_blank", "noopener,noreferrer");
    return;
  }
  openNativeScreen();
}

// Backwards-compatible alias.
export function openTermsOfService(openNativeScreen: () => void) {
  openLegalDocument("tos", openNativeScreen);
}
