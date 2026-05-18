import { MD3Theme } from "react-native-paper";

export function positiveColor(theme: MD3Theme): string {
  return theme.colors.tertiary;
}

export function negativeColor(theme: MD3Theme): string {
  return theme.colors.error;
}
