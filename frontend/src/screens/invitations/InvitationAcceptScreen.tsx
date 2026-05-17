import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Button, Card, List, Text, TextInput } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { clearUrlQuery, inviteDebug, inviteTokenFromCurrentUrl, PENDING_INVITE_STORAGE_KEY } from "../../shared/lib/inviteLinks";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function InvitationAcceptScreen({ navigation, route }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [token, setToken] = useState(route?.params?.token ?? inviteTokenFromCurrentUrl());
  const [preview, setPreview] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  async function dismissInvitation() {
    inviteDebug("invitation dismissed by user");
    await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    clearUrlQuery();
    navigation.navigate("Main");
  }

  async function loadPreview() {
    inviteDebug("invitation preview request started", {
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 6)}...` : ""
    });
    try {
      const response = await api.get(`/api/invitations/${token}/`);
      inviteDebug("invitation preview request succeeded", response);
      setPreview(response);
      setMessage("");
    } catch (error) {
      inviteDebug("invitation preview request failed", error);
      setPreview(null);
      setMessage(t("invite.invalid"));
    }
  }

  async function accept() {
    inviteDebug("invitation accept request started", {
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 6)}...` : ""
    });
    try {
      const response = await api.post(`/api/invitations/${token}/accept/`);
      inviteDebug("invitation accept request succeeded", response);
      await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      setMessage(t("invite.accepted"));
      clearUrlQuery();
      navigation.navigate("Main");
    } catch (error) {
      inviteDebug("invitation accept request failed", error);
      setMessage(t("invite.acceptFailed"));
    }
  }

  useEffect(() => {
    inviteDebug("invitation accept screen mounted or token changed", {
      routeToken: route?.params?.token ? `${route.params.token.slice(0, 6)}...` : "",
      stateToken: token ? `${token.slice(0, 6)}...` : ""
    });
    if (token) {
      loadPreview().catch(() => undefined);
    }
  }, [token]);

  return (
    <Screen>
      <Text variant="headlineSmall">{t("invite.accept")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <TextInput mode="outlined" label={t("invite.token")} value={token} onChangeText={setToken} />
          <Button mode="elevated" disabled={!token} onPress={loadPreview}>{t("common.preview")}</Button>
          {preview ? (
            <List.Item
              title={preview.group ?? preview.target_participant ?? t("invite.accept")}
              description={preview.valid ? t(`invite.type.${preview.type}`) : t("invite.expired")}
              left={(props) => <List.Icon {...props} icon="link-variant" />}
            />
          ) : null}
          <Button mode="contained" disabled={!token || (preview ? !preview.valid : false)} onPress={accept}>
            {t("invite.accept")}
          </Button>
          <Button mode="text" onPress={dismissInvitation}>{t("invite.dismiss")}</Button>
          {message ? <Text>{message}</Text> : null}
        </Card.Content>
      </Card>
    </Screen>
  );
}
