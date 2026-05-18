import { createContext, useContext } from "react";

import { ThemeMode } from "../shared/types/models";

export type PreferencesContextValue = {
  themeMode: ThemeMode;
  resolvedThemeMode: Exclude<ThemeMode, "system">;
  setThemeMode(mode: ThemeMode): void;
};

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("usePreferences must be used inside PreferencesContext.");
  }
  return value;
}
