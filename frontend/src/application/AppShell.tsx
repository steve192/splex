import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  LinkingOptions,
  NavigationContainer
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";

import { AuthProvider } from "../features/auth/AuthContext";
import { ApiClient } from "../shared/api/client";
import { I18nProvider } from "../shared/i18n/I18nContext";
import { ThemeMode } from "../shared/types/models";
import { AppNavigator } from "./AppNavigator";
import { PreferencesContext } from "./PreferencesContext";
import { RootStackParamList } from "./navigationTypes";

export function AppShell() {
  const api = useMemo(() => new ApiClient(), []);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem("splex.theme").then((stored) => {
      if (stored === "light" || stored === "dark") setThemeMode(stored);
    });
  }, []);

  const paperTheme = {
    ...(themeMode === "dark" ? MD3DarkTheme : MD3LightTheme),
    roundness: 2
  };
  const navigationTheme = {
    ...(themeMode === "dark" ? NavigationDarkTheme : NavigationLightTheme),
    colors: {
      ...(themeMode === "dark" ? NavigationDarkTheme.colors : NavigationLightTheme.colors),
      primary: paperTheme.colors.primary,
      background: paperTheme.colors.background,
      card: paperTheme.colors.surface,
      text: paperTheme.colors.onSurface,
      border: paperTheme.colors.outline
    }
  };
  const preferences = useMemo(
    () => ({
      themeMode,
      toggleTheme() {
        setThemeMode((current) => {
          const next = current === "dark" ? "light" : "dark";
          AsyncStorage.setItem("splex.theme", next).catch(() => undefined);
          return next;
        });
      }
    }),
    [themeMode]
  );

  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: [],
      config: {
        screens: {
          Login: "login",
          InvitationAccept: "invite/:token",
          Main: {
            screens: {
              Overview: {
                screens: {
                  OverviewHome: "",
                  CreateGroup: "groups/new",
                  GroupDetail: "groups/:id",
                  GroupSettings: "groups/:id/settings",
                  FriendDetail: "friends/:id",
                  ExpenseDetail: "expenses/:id",
                  SettlementDetail: "settlements/:id"
                }
              },
              Add: {
                screens: {
                  AddHome: "add"
                }
              },
              Activity: {
                screens: {
                  ActivityHome: "activity"
                }
              },
              Account: "account"
            }
          }
        }
      }
    }),
    []
  );

  return (
    <PreferencesContext.Provider value={preferences}>
      <PaperProvider
        theme={paperTheme}
        settings={{
          icon: (props) => <MaterialCommunityIcons {...props} name={props.name as any} />
        }}
      >
        <I18nProvider>
          <AuthProvider api={api}>
            <NavigationContainer theme={navigationTheme} linking={linking}>
              <AppNavigator />
            </NavigationContainer>
            <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
          </AuthProvider>
        </I18nProvider>
      </PaperProvider>
    </PreferencesContext.Provider>
  );
}
