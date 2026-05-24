import { Platform } from "react-native";

export type LegalDocumentKind = "tos" | "privacy" | "imprint";

const WEB_PATHS: Record<LegalDocumentKind, string> = {
  tos: "/tos",
  privacy: "/privacy",
  imprint: "/imprint"
};

export function openLegalDocument(kind: LegalDocumentKind, openNativeScreen: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(new URL(WEB_PATHS[kind], window.location.href).toString(), "_blank", "noopener,noreferrer");
    return;
  }
  openNativeScreen();
}

// Backwards-compatible alias.
export function openTermsOfService(openNativeScreen: () => void) {
  openLegalDocument("tos", openNativeScreen);
}
