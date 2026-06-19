import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  LinkingOptions,
  NavigationContainer,
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../features/auth/AuthContext";
import { ApiClient, NATIVE_DEFAULT_BASE_URL } from "../shared/api/client";
import { addBasePath, restoreBasePathInState, stripBasePath } from "../shared/config/basePath";
import { DemoWriteBlockedSnackbar } from "../shared/demo/DemoWriteBlockedSnackbar";
import { FeedbackProvider } from "../shared/feedback/FeedbackContext";
import { SnackbarProvider } from "../shared/feedback/SnackbarContext";
import { I18nProvider } from "../shared/i18n/I18nContext";
import { ensureServiceWorkerRegistration } from "../shared/lib/serviceWorker";
import { PwaInstallPrompt } from "../shared/pwa/PwaInstallPrompt";
import { ThemeMode } from "../shared/types/models";
import { styles } from "../shared/ui/styles";
import { AppNavigator } from "./AppNavigator";
import { PreferencesContext } from "./PreferencesContext";
import { RootStackParamList } from "./navigationTypes";
import { createAppTheme, createNavigationTheme } from "./theme";
import { UpdateSnackbar } from "../shared/updates/UpdateSnackbar";

export function AppShell() {
  const api = useMemo(() => new ApiClient(), []);
  const systemThemeMode = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  let resolvedThemeMode: "light" | "dark";
  if (themeMode === "system") {
    resolvedThemeMode = systemThemeMode === "dark" ? "dark" : "light";
  } else {
    resolvedThemeMode = themeMode;
  }

  useEffect(() => {
    AsyncStorage.getItem("splex.theme").then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") setThemeMode(stored);
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
  const updateThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    AsyncStorage.setItem("splex.theme", mode).catch(() => undefined);
  }, []);
  const preferences = useMemo(
    () => ({
      themeMode,
      resolvedThemeMode,
      setThemeMode: updateThemeMode
    }),
    [resolvedThemeMode, themeMode, updateThemeMode]
  );

  const linking = useMemo<LinkingOptions<RootStackParamList>>(
    () => ({
      prefixes: [Linking.createURL("/"), NATIVE_DEFAULT_BASE_URL],
      config: {
        screens: {
          Login: "login",
          LoginMagic: "login/magic",
          TermsOfService: "tos",
          PrivacyPolicy: "privacy",
          Imprint: "imprint",
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
      },
      // The app is served under /app (expo.experiments.baseUrl). React
      // Navigation matches the screen config above relative to the root, so we
      // strip the /app prefix off incoming deep-link paths before parsing and
      // re-add it to generated paths. See shared/config/basePath.ts.
      getStateFromPath(path, options) {
        const state = defaultGetStateFromPath(stripBasePath(path), options);
        // React Navigation echoes the focused route's stored `path` back into
        // the web address bar on initial load, bypassing getPathFromState; we
        // fed it the stripped path, so restore the /app prefix here.
        return state ? restoreBasePathInState(state) : state;
      },
      getPathFromState(state, config) {
        return addBasePath(defaultGetPathFromState(state, config));
      }
    }),
    []
  );

  return (
    <GestureHandlerRootView style={styles.flex}>
      <PreferencesContext.Provider value={preferences}>
        <I18nProvider>
          {/* AuthProvider must sit ABOVE PaperProvider so the Portal host that
            backs <Dialog>/<Portal>/<Modal> from react-native-paper has access
            to AuthContext via React context.  Paper's Portal re-parents
            children under Portal.Host (which lives inside PaperProvider);
            anything portalled would otherwise lose every context provided
            below PaperProvider. */}
          <AuthProvider api={api}>
            <PaperProvider
              theme={paperTheme}
              settings={{
                icon: (props) => <MaterialCommunityIcons {...props} name={props.name as any} />
              }}
            >
              <SafeAreaProvider>
                <FeedbackProvider>
                  <SnackbarProvider>
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
                      <UpdateSnackbar />
                      <DemoWriteBlockedSnackbar />
                      <PwaInstallPrompt />
                    </View>
                  </SnackbarProvider>
                </FeedbackProvider>
                <StatusBar style={resolvedThemeMode === "dark" ? "light" : "dark"} />
              </SafeAreaProvider>
            </PaperProvider>
          </AuthProvider>
        </I18nProvider>
      </PreferencesContext.Provider>
    </GestureHandlerRootView>
  );
}
