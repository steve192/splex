import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, List, Text } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { RootStackParamList } from "../../application/navigationTypes";
import { useI18n } from "../../shared/i18n/I18nContext";
import { clearUrlQuery, inviteDebug, inviteTokenFromCurrentUrl, PENDING_INVITE_STORAGE_KEY } from "../../shared/lib/inviteLinks";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type InvitationPreview = {
  valid: boolean;
  type: string;
  group?: string;
  group_image_url?: string;
  invited_by?: string;
  invited_by_image_url?: string;
  target_participant?: string;
};

type InvitationAcceptScreenProps = NativeStackScreenProps<RootStackParamList, "InvitationAccept">;

export function InvitationAcceptScreen({ navigation, route }: InvitationAcceptScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [token, setToken] = useState(route?.params?.token ?? inviteTokenFromCurrentUrl());
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
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
      const response = await api.get<InvitationPreview>(`/api/invitations/${token}/`);
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
          {preview ? (
            <>
              <View style={styles.rowBetween}>
                <View style={styles.inline}>
                  <PersonAvatar
                    name={preview.invited_by ?? t("invite.invitedBy")}
                    imageUrl={preview.invited_by_image_url}
                    size={48}
                  />
                  <View>
                    <Text variant="labelMedium">{t("invite.invitedBy")}</Text>
                    <Text variant="titleMedium">{preview.invited_by}</Text>
                  </View>
                </View>
              </View>
              {preview.group ? (
                <List.Item
                  title={preview.group}
                  description={t("invite.group")}
                  left={() => <PersonAvatar name={preview.group ?? ""} imageUrl={preview.group_image_url} />}
                />
              ) : null}
              {preview.target_participant ? (
                <List.Item
                  title={preview.target_participant}
                  description={t(`invite.type.${preview.type}`)}
                  left={(props) => <List.Icon {...props} icon="account-outline" />}
                />
              ) : null}
              {!preview.valid ? <Text variant="bodyMedium">{t("invite.expired")}</Text> : null}
            </>
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
