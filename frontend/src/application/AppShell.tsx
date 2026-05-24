import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinkingOptions, NavigationContainer } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../features/auth/AuthContext";
import { ApiClient } from "../shared/api/client";
import { DemoWriteBlockedSnackbar } from "../shared/demo/DemoWriteBlockedSnackbar";
import { FeedbackProvider } from "../shared/feedback/FeedbackContext";
import { I18nProvider } from "../shared/i18n/I18nContext";
import { ensureServiceWorkerRegistration } from "../shared/lib/serviceWorker";
import { ThemeMode } from "../shared/types/models";
import { styles } from "../shared/ui/styles";
import { AppNavigator } from "./AppNavigator";
import { PostLoginBootstrap } from "./PostLoginBootstrap";
import { PreferencesContext } from "./PreferencesContext";
import { RootStackParamList } from "./navigationTypes";
import { createAppTheme, createNavigationTheme } from "./theme";
import { UpdateSnackbar } from "../shared/updates/UpdateSnackbar";

export function AppShell() {
  const api = useMemo(() => new ApiClient(), []);
  const systemThemeMode = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const resolvedThemeMode = themeMode === "system" ? (systemThemeMode === "dark" ? "dark" : "light") : themeMode;

  useEffect(() => {
    AsyncStorage.getItem("splex.theme").then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") setThemeModeState(stored);
    });
    // On web, eagerly register/refresh the service worker so a deployed update
    // takes over the existing tab without the user manually closing it.
    ensureServiceWorkerRegistration().catch(() => undefined);
  }, []);

  const paperTheme = useMemo(() => createAppTheme(resolvedThemeMode), [resolvedThemeMode]);
  const navigationTheme = useMemo(
    () => createNavigationTheme(resolvedThemeMode, paperTheme),
    [paperTheme, resolvedThemeMode]
  );
  const preferences = useMemo(
    () => ({
      themeMode,
      resolvedThemeMode,
      setThemeMode(mode: ThemeMode) {
        setThemeModeState(mode);
        AsyncStorage.setItem("splex.theme", mode).catch(() => undefined);
      }
    }),
    [resolvedThemeMode, themeMode]
  );

  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: [],
      config: {
        screens: {
          Login: "login",
          TermsOfService: "tos",
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
    <GestureHandlerRootView style={styles.flex}>
    <PreferencesContext.Provider value={preferences}>
      <I18nProvider>
        <PaperProvider
          theme={paperTheme}
          settings={{
            icon: (props) => <MaterialCommunityIcons {...props} name={props.name as any} />
          }}
        >
          <SafeAreaProvider>
            <AuthProvider api={api}>
              <FeedbackProvider>
                <View style={[styles.flex, { backgroundColor: paperTheme.colors.background }]}>
                  <NavigationContainer
                    theme={navigationTheme}
                    linking={linking}
                    documentTitle={{
                      formatter(options) {
                        return options?.title ? `Splex | ${options.title}` : "Splex";
                      }
                    }}
                  >
                    <AppNavigator />
                  </NavigationContainer>
                  <PostLoginBootstrap />
                  <UpdateSnackbar />
                  <DemoWriteBlockedSnackbar />
                </View>
              </FeedbackProvider>
              <StatusBar
                style={resolvedThemeMode === "dark" ? "light" : "dark"}
                backgroundColor={paperTheme.colors.background}
              />
            </AuthProvider>
          </SafeAreaProvider>
        </PaperProvider>
      </I18nProvider>
    </PreferencesContext.Provider>
    </GestureHandlerRootView>
  );
}
