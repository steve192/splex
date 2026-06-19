import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  List,
  Portal,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { asNumber } from "../../shared/lib/money";
import { useCachedQuery } from "../../shared/lib/useCachedQuery";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import { Friend } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type FriendSettingsScreenProps = NativeStackScreenProps<
  OverviewStackParamList,
  "FriendSettings"
>;
type FriendSettingsAction = "archive" | "remove";

export function FriendSettingsScreen({
  route,
  navigation,
}: Readonly<FriendSettingsScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const { showSnackbar } = useSnackbar();
  const { hasPending, isPending, runPendingAction } =
    usePendingAction<FriendSettingsAction>();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const friendshipId = route.params.id;
  const [archived, setArchived] = useState(false);
  const [archiveDirty, setArchiveDirty] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const friendQuery = useCachedQuery<Friend>({
    load: useCallback(
      ({ cachedGet }) =>
        cachedGet<Friend>(api, `/api/friends/${friendshipId}/`),
      [api, friendshipId],
    ),
  });
  const friend = friendQuery.data;
  const isSettled = friend ? asNumber(friend.balance) === 0 : false;

  useFocusEffect(
    useCallback(() => {
      friendQuery.reload().catch(() => undefined);
    }, [friendQuery.reload]),
  );

  useEffect(() => {
    setArchiveDirty(false);
  }, [friendshipId]);

  useEffect(() => {
    if (friend && !archiveDirty) {
      setArchived(Boolean(friend.archived_at));
    }
  }, [archiveDirty, friend]);

  async function saveArchive() {
    await runPendingAction("archive", async () => {
      try {
        await api.patch(`/api/friends/${friendshipId}/`, { archived });
        await friendQuery.reloadFresh();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setArchiveDirty(false);
      showSuccess({ icon: "archive-check-outline" });
      showSnackbar(t("friend.saved"), { duration: 9000 });
    });
  }

  async function removeFriend() {
    await runPendingAction("remove", async () => {
      try {
        await api.delete(`/api/friends/${friendshipId}/`);
        setRemoveConfirmVisible(false);
        navigation.navigate("OverviewHome");
      } catch (error) {
        setRemoveConfirmVisible(false);
        showSnackbar(apiWriteErrorMessage(error, t));
      }
    });
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.inline}>
          <Text variant="headlineSmall">{t("friend.settings")}</Text>
          {friendQuery.loading && <ActivityIndicator size={16} />}
        </View>
        {friend ? (
          <Card mode="elevated">
            <Card.Content style={styles.memberCardRow}>
              <PersonAvatar
                name={friend.display_name}
                imageUrl={friend.avatar_url}
              />
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
            <List.Item
              title={t("friend.archived")}
              right={renderArchiveSwitch(archived, (value) => {
                setArchived(value);
                setArchiveDirty(true);
              })}
            />
            <Button
              mode="elevated"
              loading={isPending("archive")}
              disabled={hasPending}
              onPress={saveArchive}
            >
              {t("friend.saveArchive")}
            </Button>
            {!isSettled && (
              <Text variant="bodyMedium">{t("friend.removeBlocked")}</Text>
            )}
            <Button
              mode="contained-tonal"
              icon="account-remove-outline"
              textColor={dangerColor}
              disabled={hasPending || !isSettled}
              onPress={() => setRemoveConfirmVisible(true)}
            >
              {t("friend.remove")}
            </Button>
          </Card.Content>
        </Card>
      </Screen>

      <Portal>
        <Dialog
          visible={removeConfirmVisible}
          onDismiss={
            hasPending ? () => undefined : () => setRemoveConfirmVisible(false)
          }
        >
          <Dialog.Title>{t("friend.remove")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("friend.removeConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              disabled={hasPending}
              onPress={() => setRemoveConfirmVisible(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              textColor={dangerColor}
              loading={isPending("remove")}
              disabled={hasPending}
              onPress={removeFriend}
            >
              {t("friend.remove")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function renderArchiveSwitch(
  value: boolean,
  onValueChange: (value: boolean) => void,
) {
  return function ArchiveSwitchRenderer() {
    return <Switch value={value} onValueChange={onValueChange} />;
  };
}
