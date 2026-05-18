import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  Theme as NavigationTheme
} from "@react-navigation/native";
import { MD3DarkTheme, MD3LightTheme, MD3Theme } from "react-native-paper";

import { ThemeMode } from "../shared/types/models";

type ResolvedThemeMode = Exclude<ThemeMode, "system">;

const lightColors: Partial<MD3Theme["colors"]> = {
  primary: "#006A60",
  onPrimary: "#FFFFFF",
  primaryContainer: "#9EF2E3",
  onPrimaryContainer: "#00201C",
  secondary: "#4A635E",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#CCE8E1",
  onSecondaryContainer: "#06201B",
  tertiary: "#2F6B2F",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#B2F2AA",
  onTertiaryContainer: "#002105",
  error: "#BA1A1A",
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",
  background: "#F6FAF8",
  onBackground: "#171D1B",
  surface: "#FFFFFF",
  onSurface: "#171D1B",
  surfaceVariant: "#DCE5E1",
  onSurfaceVariant: "#404946",
  outline: "#707976",
  outlineVariant: "#C0C9C5",
  inverseSurface: "#2C3230",
  inverseOnSurface: "#EDF1EE",
  inversePrimary: "#82D5C8",
  elevation: {
    level0: "transparent",
    level1: "#EDF7F4",
    level2: "#E8F4F1",
    level3: "#E2F1ED",
    level4: "#E0F0EB",
    level5: "#DCEDE9"
  },
  surfaceDisabled: "rgba(23, 29, 27, 0.12)",
  onSurfaceDisabled: "rgba(23, 29, 27, 0.38)",
  backdrop: "rgba(42, 50, 47, 0.4)"
};

const darkColors: Partial<MD3Theme["colors"]> = {
  primary: "#82D5C8",
  onPrimary: "#003731",
  primaryContainer: "#005048",
  onPrimaryContainer: "#9EF2E3",
  secondary: "#B0CCC5",
  onSecondary: "#1C3530",
  secondaryContainer: "#334B46",
  onSecondaryContainer: "#CCE8E1",
  tertiary: "#97D58F",
  onTertiary: "#00390B",
  tertiaryContainer: "#165116",
  onTertiaryContainer: "#B2F2AA",
  error: "#FFB4AB",
  onError: "#690005",
  errorContainer: "#93000A",
  onErrorContainer: "#FFDAD6",
  background: "#101513",
  onBackground: "#DFE4E1",
  surface: "#171D1B",
  onSurface: "#DFE4E1",
  surfaceVariant: "#404946",
  onSurfaceVariant: "#C0C9C5",
  outline: "#8A938F",
  outlineVariant: "#404946",
  inverseSurface: "#DFE4E1",
  inverseOnSurface: "#2C3230",
  inversePrimary: "#006A60",
  elevation: {
    level0: "transparent",
    level1: "#1B2623",
    level2: "#1F2C29",
    level3: "#23322E",
    level4: "#243430",
    level5: "#273934"
  },
  surfaceDisabled: "rgba(223, 228, 225, 0.12)",
  onSurfaceDisabled: "rgba(223, 228, 225, 0.38)",
  backdrop: "rgba(42, 50, 47, 0.4)"
};

export function createAppTheme(mode: ResolvedThemeMode): MD3Theme {
  const baseTheme = mode === "dark" ? MD3DarkTheme : MD3LightTheme;
  return {
    ...baseTheme,
    roundness: 2,
    colors: {
      ...baseTheme.colors,
      ...(mode === "dark" ? darkColors : lightColors)
    }
  };
}

export function createNavigationTheme(mode: ResolvedThemeMode, paperTheme: MD3Theme): NavigationTheme {
  const baseTheme = mode === "dark" ? NavigationDarkTheme : NavigationLightTheme;
  return {
    ...baseTheme,
    dark: mode === "dark",
    colors: {
      ...baseTheme.colors,
      primary: paperTheme.colors.primary,
      background: paperTheme.colors.background,
      card: paperTheme.colors.surface,
      text: paperTheme.colors.onSurface,
      border: paperTheme.colors.outlineVariant,
      notification: paperTheme.colors.error
    }
  };
}
