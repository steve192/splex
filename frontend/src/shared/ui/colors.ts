import { MD3Theme } from "react-native-paper";

export function positiveColor(theme: MD3Theme): string {
  return theme.dark ? "#7DDC9F" : "#0F7B3A";
}

export function negativeColor(theme: MD3Theme): string {
  return theme.colors.error;
}
