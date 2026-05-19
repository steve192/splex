import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button, Divider, HelperText, IconButton, Surface, Text, TextInput, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { useI18n } from "../../shared/i18n/I18nContext";
import { clearUrlQuery, inviteDebug, inviteTokenFromCurrentUrl, PENDING_INVITE_STORAGE_KEY, tokenFromCurrentUrl } from "../../shared/lib/inviteLinks";
import { styles } from "../../shared/ui/styles";

export function LoginScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { api, loginWithCode, loginWithToken, requestMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginRequested, setLoginRequested] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");
  const [backendSettingsOpen, setBackendSettingsOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android") {
      api.getBaseUrl().then(setBackendUrl).catch(() => undefined);
    }
    inviteDebug("login screen mounted");
    const inviteToken = inviteTokenFromCurrentUrl();
    if (inviteToken) {
      inviteDebug("login screen storing pending invite token");
      AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, inviteToken).catch(() => undefined);
      setMessage(t("invite.loginRequired"));
    }
    const token = tokenFromCurrentUrl();
    if (!token) return;
    inviteDebug("login screen found magic token; attempting login");
    setLoading(true);
    loginWithToken(token)
      .then(() => {
        inviteDebug("magic token login succeeded");
        clearUrlQuery();
      })
      .catch((error) => {
        inviteDebug("magic token login failed", error);
        setMessage(t("auth.linkFailed"));
      })
      .finally(() => setLoading(false));
  }, []);

  async function requestLink() {
    inviteDebug("magic link request started");
    setLoading(true);
    try {
      const inviteToken =
        inviteTokenFromCurrentUrl() || (await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY));
      inviteDebug("magic link request using invite token", { hasInviteToken: Boolean(inviteToken) });
      await requestMagicLink(email, inviteToken || undefined);
      setLoginRequested(true);
      setCode("");
      setMessage(t("auth.sent"));
      inviteDebug("magic link request succeeded");
    } catch (error) {
      inviteDebug("magic link request failed", error);
      setMessage(t("auth.sendFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function saveBackendUrl(value: string) {
    setBackendUrl(value);
    await api.setBaseUrl(value);
  }

  async function verifyCode() {
    inviteDebug("magic code verification started");
    setLoading(true);
    try {
      await loginWithCode(email, code);
      inviteDebug("magic code verification succeeded");
    } catch (error) {
      inviteDebug("magic code verification failed", error);
      setMessage(t("auth.codeFailed"));
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <>
      <TextInput
        mode="outlined"
        label={t("auth.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setCode("");
          setLoginRequested(false);
          setMessage("");
        }}
      />
      <Button mode="contained" loading={loading} disabled={!email || loading} onPress={requestLink}>
        {t("auth.request")}
      </Button>
      {loginRequested ? (
        <>
          <Divider />
          <TextInput
            mode="outlined"
            label={t("auth.code")}
            value={code}
            onChangeText={setCode}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          <Button mode="elevated" disabled={!email || !code || loading} onPress={verifyCode}>
            {t("auth.verify")}
          </Button>
        </>
      ) : null}
      {Platform.OS === "android" ? (
        <>
          <Divider />
          <View style={styles.rowBetween}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("auth.backendUrl")}
            </Text>
            <IconButton icon="cog-outline" onPress={() => setBackendSettingsOpen((current) => !current)} />
          </View>
          {backendSettingsOpen ? (
            <TextInput
              mode="outlined"
              label={t("auth.backendUrl")}
              autoCapitalize="none"
              autoCorrect={false}
              value={backendUrl}
              onChangeText={(value) => {
                setBackendUrl(value);
                saveBackendUrl(value).catch(() => undefined);
              }}
            />
          ) : null}
        </>
      ) : null}
      {message ? <HelperText type={message.includes("failed") ? "error" : "info"}>{message}</HelperText> : null}
    </>
  );

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
            paddingBottom: 20 + insets.bottom
          }
        ]}
      >
        <View
          style={[
            styles.loginShell,
            Platform.OS === "web" ? styles.loginShellWeb : undefined
          ]}
        >
          <View
            style={[
              styles.loginHero,
              Platform.OS === "web" ? styles.loginHeroWeb : undefined
            ]}
          >
            <View style={styles.loginBrandMark}>
              <Image source={appImages.pwaMaskableIcon} style={styles.loginBrandImage} />
            </View>
            <Text variant="displaySmall" style={styles.loginTitle}>
              {t("auth.title")}
            </Text>
            <Text variant="bodyLarge" style={[styles.loginSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {t("auth.subtitle")}
            </Text>
          </View>
          <Surface
            mode={Platform.OS === "web" ? "elevated" : "flat"}
            style={[
              styles.loginPanel,
              Platform.OS === "web" ? styles.loginPanelWeb : undefined,
              { backgroundColor: theme.colors.surface }
            ]}
          >
            {form}
          </Surface>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
