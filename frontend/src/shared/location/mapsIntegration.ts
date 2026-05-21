import * as Linking from "expo-linking";
import { Platform } from "react-native";

export async function openLocationInMaps(latitude: number, longitude: number): Promise<void> {
  if (Platform.OS === "web") {
    // Open in new window on web
    const url = `https://maps.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, "_blank");
    return;
  }

  if (Platform.OS === "ios") {
    // Apple Maps URL scheme
    const url = `maps://maps.apple.com/?daddr=${latitude},${longitude}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  }

  if (Platform.OS === "android") {
    // Google Maps geo URI
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  }

  // Fallback to web Google Maps
  const url = `https://maps.google.com/maps?q=${latitude},${longitude}`;
  window.open(url, "_blank");
}
