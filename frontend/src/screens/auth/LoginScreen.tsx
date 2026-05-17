import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Button, Card, Divider, HelperText, Text, TextInput } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { clearUrlQuery, inviteDebug, inviteTokenFromCurrentUrl, PENDING_INVITE_STORAGE_KEY, tokenFromCurrentUrl } from "../../shared/lib/inviteLinks";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function LoginScreen() {
  const { t } = useI18n();
  const { loginWithCode, loginWithToken, requestMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
      setMessage(t("auth.sent"));
      inviteDebug("magic link request succeeded");
    } catch (error) {
      inviteDebug("magic link request failed", error);
      setMessage(t("auth.sendFailed"));
    } finally {
      setLoading(false);
    }
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

  return (
    <Screen>
      <Card style={styles.authCard}>
        <Card.Content style={styles.gap}>
          <Text variant="headlineMedium">{t("auth.title")}</Text>
          <Text variant="bodyMedium">{t("auth.subtitle")}</Text>
          <TextInput
            mode="outlined"
            label={t("auth.email")}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Button mode="contained" loading={loading} disabled={!email || loading} onPress={requestLink}>
            {t("auth.request")}
          </Button>
          <Divider />
          <TextInput mode="outlined" label={t("auth.code")} value={code} onChangeText={setCode} />
          <Button mode="elevated" disabled={!email || !code || loading} onPress={verifyCode}>
            {t("auth.verify")}
          </Button>
          {message ? <HelperText type={message.includes("failed") ? "error" : "info"}>{message}</HelperText> : null}
        </Card.Content>
      </Card>
    </Screen>
  );
}
