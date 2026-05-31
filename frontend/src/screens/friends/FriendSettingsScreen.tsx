import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Button, Card, Dialog, List, Portal, Snackbar, Switch, Text, useTheme } from "react-native-paper";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { apiErrorMessage } from "../../shared/lib/apiErrors";
import { asNumber } from "../../shared/lib/money";
import { cachedGet } from "../../shared/lib/offlineCache";
import { Friend } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type FriendSettingsScreenProps = NativeStackScreenProps<OverviewStackParamList, "FriendSettings">;

export function FriendSettingsScreen({ route, navigation }: Readonly<FriendSettingsScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const friendshipId = route.params.id;
  const [friend, setFriend] = useState<Friend | null>(null);
  const [archived, setArchived] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const isSettled = friend ? asNumber(friend.balance) === 0 : false;

  async function load() {
    const row = await cachedGet<Friend>(api, `/api/friends/${friendshipId}/`);
    setFriend(row);
    setArchived(Boolean(row.archived_at));
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [friendshipId])
  );

  async function saveArchive() {
    await api.patch(`/api/friends/${friendshipId}/`, { archived });
    await load();
    showSuccess({ icon: "archive-check-outline" });
    setSnackbar(t("friend.saved"));
  }

  async function removeFriend() {
    setRemoveConfirmVisible(false);
    try {
      await api.delete(`/api/friends/${friendshipId}/`);
      navigation.navigate("OverviewHome");
    } catch (error) {
      setSnackbar(apiErrorMessage(error, t));
    }
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <Text variant="headlineSmall">{t("friend.settings")}</Text>
        {friend ? (
          <Card mode="elevated">
            <Card.Content style={styles.memberCardRow}>
              <PersonAvatar name={friend.display_name} imageUrl={friend.avatar_url} />
              <View style={styles.memberContent}>
                <Text variant="titleMedium">{friend.display_name}</Text>
                <Text variant="bodyMedium">{friend.default_currency}</Text>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("friend.management")}</Text>
            <List.Item title={t("friend.archived")} right={renderArchiveSwitch(archived, setArchived)} />
            <Button mode="elevated" onPress={saveArchive}>
              {t("friend.saveArchive")}
            </Button>
            {!isSettled ? <Text variant="bodyMedium">{t("friend.removeBlocked")}</Text> : null}
            <Button
              mode="contained-tonal"
              icon="account-remove-outline"
              textColor={dangerColor}
              disabled={!isSettled}
              onPress={() => setRemoveConfirmVisible(true)}
            >
              {t("friend.remove")}
            </Button>
          </Card.Content>
        </Card>
      </Screen>

      <Portal>
        <Dialog visible={removeConfirmVisible} onDismiss={() => setRemoveConfirmVisible(false)}>
          <Dialog.Title>{t("friend.remove")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("friend.removeConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveConfirmVisible(false)}>{t("common.cancel")}</Button>
            <Button textColor={dangerColor} onPress={removeFriend}>
              {t("friend.remove")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={9000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

function renderArchiveSwitch(value: boolean, onValueChange: (value: boolean) => void) {
  return function ArchiveSwitchRenderer() {
    return <Switch value={value} onValueChange={onValueChange} />;
  };
}
