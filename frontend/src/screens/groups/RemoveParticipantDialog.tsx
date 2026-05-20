import { useEffect, useState } from "react";
import { View } from "react-native";
import { ActivityIndicator, Button, Dialog, HelperText, List, Text, useTheme } from "react-native-paper";

import { ApiClient } from "../../shared/api/client";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Participant } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { MoneyText } from "../../shared/ui/MoneyText";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";

type OutstandingRow = {
  participant_id: number;
  display_name: string;
  avatar_url: string;
  amount: string;
};

type OutstandingResponse = {
  currency: string;
  owes: OutstandingRow[];
  owed_by: OutstandingRow[];
};

type RemoveParticipantDialogProps = {
  api: ApiClient;
  groupId: number;
  target: Participant | null;
  onDismiss(): void;
  onConfirm(): Promise<void> | void;
};

export function RemoveParticipantDialog({ api, groupId, target, onDismiss, onConfirm }: RemoveParticipantDialogProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [outstanding, setOutstanding] = useState<OutstandingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) {
      setOutstanding(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setOutstanding(null);
    api
      .get<OutstandingResponse>(`/api/groups/${groupId}/participants/${target.id}/outstanding/`)
      .then((data) => {
        if (!cancelled) setOutstanding(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, groupId, target]);

  const hasOutstanding = Boolean(outstanding && (outstanding.owes.length || outstanding.owed_by.length));

  return (
    <Dialog visible={!!target} onDismiss={onDismiss}>
      <Dialog.Title>{t("group.removeMember")}</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="titleMedium">{target?.display_name ?? ""}</Text>
        {loading ? (
          <View style={styles.formRow}>
            <ActivityIndicator />
            <Text>{t("group.removeMember.checkingOutstanding")}</Text>
          </View>
        ) : null}
        {hasOutstanding && outstanding ? (
          <>
            <HelperText type="error" visible style={{ color: negativeColor(theme) }}>
              {t("group.removeMember.outstandingWarning", { name: target?.display_name ?? "" })}
            </HelperText>
            {outstanding.owes.length ? (
              <View style={styles.gap}>
                <Text variant="titleSmall">
                  {t("group.removeMember.owesHeader", { name: target?.display_name ?? "" })}
                </Text>
                {outstanding.owes.map((row) => (
                  <OutstandingLine key={`owes-${row.participant_id}`} row={row} currency={outstanding.currency} />
                ))}
              </View>
            ) : null}
            {outstanding.owed_by.length ? (
              <View style={styles.gap}>
                <Text variant="titleSmall">
                  {t("group.removeMember.owedByHeader", { name: target?.display_name ?? "" })}
                </Text>
                {outstanding.owed_by.map((row) => (
                  <OutstandingLine key={`owed-${row.participant_id}`} row={row} currency={outstanding.currency} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>{t("common.cancel")}</Button>
        <Button onPress={onConfirm}>{t("common.delete")}</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function OutstandingLine({ row, currency }: { row: OutstandingRow; currency: string }) {
  return (
    <List.Item
      title={row.display_name}
      left={() => <PersonAvatar name={row.display_name} imageUrl={row.avatar_url} size={36} />}
      right={() => (
        <View style={styles.listTileRight}>
          <MoneyText plain amount={row.amount} currency={currency} />
        </View>
      )}
    />
  );
}
