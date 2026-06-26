import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RootStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { useI18n } from "../../shared/i18n/I18nContext";
import { detectDeviceLocale } from "../../shared/i18n/locale";
import { LegalFooterLinks } from "../../shared/legal/LegalFooterLinks";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import {
  inviteDebug,
  inviteTokenFromCurrentUrl,
  PENDING_INVITE_STORAGE_KEY,
} from "../../shared/lib/inviteLinks";
import { styles } from "../../shared/ui/styles";

import { LoginMessage, shouldShowDemoMode } from "./loginHelpers";
import { DemoModeSection, LoginFormSection } from "./loginScreenSections";
import { useLoginBootstrap } from "./useLoginBootstrap";

type Props = NativeStackScreenProps<RootStackParamList, "Login" | "LoginMagic">;

export function LoginScreen({ route }: Readonly<Props>) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    api,
    loginAsDemo,
    loginWithCode,
    loginWithGoogle,
    loginWithToken,
    requestMagicLink,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<LoginMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginRequested, setLoginRequested] = useState(false);
  const [backendSettingsOpen, setBackendSettingsOpen] = useState(false);

  function notifyError(text: string) {
    setMessage({ text, tone: "error" });
  }

  function notifyInfo(text: string) {
    setMessage({ text, tone: "info" });
  }

  const routeToken = route.params?.token;
  const routeInviteToken = route.params?.inviteToken;

  const {
    googleClientId,
    googleAndroidClientId,
    demoModeEnabled,
    providersResolved,
    backendUrl,
    setBackendUrl,
  } = useLoginBootstrap({
    api,
    loginWithGoogle,
    loginWithToken,
    routeToken,
    routeInviteToken,
    setLoading,
    notifyError,
    notifyInfo,
    t,
  });

  function onEmailChange(value: string) {
    setEmail(value);
    setCode("");
    setLoginRequested(false);
    setMessage(null);
  }

  function onBackendUrlChange(value: string) {
    saveBackendUrl(value).catch(() => undefined);
  }

  async function requestLink() {
    if (loading) return;
    inviteDebug("magic link request started");
    setLoading(true);
    try {
      const requestLocale = detectDeviceLocale();
      const inviteToken =
        routeInviteToken ||
        inviteTokenFromCurrentUrl() ||
        (await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY));
      inviteDebug("magic link request using invite token", {
        hasInviteToken: Boolean(inviteToken),
      });
      await requestMagicLink(email, inviteToken || undefined, requestLocale);
      setLoginRequested(true);
      setCode("");
      notifyInfo(t("auth.sent"));
      inviteDebug("magic link request succeeded");
    } catch (error) {
      inviteDebug("magic link request failed", error);
      notifyError(apiWriteErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }

  async function saveBackendUrl(value: string) {
    setBackendUrl(value);
    await api.setBaseUrl(value);
  }

  async function startDemo() {
    if (loading) return;
    setLoading(true);
    try {
      await loginAsDemo();
    } catch {
      notifyError(t("auth.demoFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (loading) return;
    inviteDebug("magic code verification started");
    setLoading(true);
    try {
      await loginWithCode(email, code);
      inviteDebug("magic code verification succeeded");
    } catch (error) {
      inviteDebug("magic code verification failed", error);
      notifyError(apiWriteErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.loginScreen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: 20 + insets.top,
            paddingBottom: 20 + insets.bottom,
          },
        ]}
      >
        <View style={styles.loginContent}>
          <View
            style={[
              styles.loginShell,
              Platform.OS === "web" ? styles.loginShellWeb : undefined,
            ]}
          >
            <View
              style={[
                styles.loginHero,
                Platform.OS === "web" ? styles.loginHeroWeb : undefined,
              ]}
            >
              <View style={styles.loginBrandMark}>
                <Image
                  source={appImages.pwaMaskableIcon}
                  style={styles.loginBrandImage}
                />
              </View>
              <Text variant="displaySmall" style={styles.loginTitle}>
                {t("auth.title")}
              </Text>
              <Text
                variant="bodyLarge"
                style={[
                  styles.loginSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("auth.subtitle")}
              </Text>
            </View>
            <Surface
              mode={Platform.OS === "web" ? "elevated" : "flat"}
              style={[
                styles.loginPanel,
                Platform.OS === "web" ? styles.loginPanelWeb : undefined,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <LoginFormSection
                backendSettingsOpen={backendSettingsOpen}
                backendUrl={backendUrl}
                code={code}
                email={email}
                googleAndroidClientId={googleAndroidClientId}
                googleClientId={googleClientId}
                loading={loading}
                loginRequested={loginRequested}
                message={message}
                onBackendSettingsToggle={() =>
                  setBackendSettingsOpen((current) => !current)
                }
                onBackendUrlChange={onBackendUrlChange}
                onCodeChange={setCode}
                onEmailChange={onEmailChange}
                onGoogleError={notifyError}
                onRequestLink={() => requestLink().catch(() => undefined)}
                onVerifyCode={() => verifyCode().catch(() => undefined)}
              />
              {shouldShowDemoMode(providersResolved, demoModeEnabled) ? (
                <DemoModeSection
                  loading={loading}
                  onStartDemo={() => startDemo().catch(() => undefined)}
                />
              ) : null}
            </Surface>
          </View>
        </View>
        <View style={styles.loginFooter}>
          <LegalFooterLinks />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
