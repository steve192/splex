import { Platform } from "react-native";

export function openTermsOfService(openNativeScreen: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(new URL("/tos", window.location.href).toString(), "_blank", "noopener,noreferrer");
    return;
  }
  openNativeScreen();
}