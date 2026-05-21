import { useEffect, useState } from "react";
import { View } from "react-native";
import { ActivityIndicator, Button, Dialog, HelperText, List, Text } from "react-native-paper";

import { ApiClient } from "../../shared/api/client";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Participant } from "../../shared/types/models";
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
  visible?: boolean;
  title?: string;
  confirmLabel?: string;
  extraMessage?: string;
  onDismiss(): void;
  onConfirm(): Promise<void> | void;
};

export function RemoveParticipantDialog({
  api,
  groupId,
  target,
  visible,
  title,
  confirmLabel,
  extraMessage,
  onDismiss,
  onConfirm
}: Readonly<RemoveParticipantDialogProps>) {
  const { t } = useI18n();
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
    <Dialog visible={visible ?? !!target} onDismiss={onDismiss}>
      <Dialog.Title>{title ?? t("group.removeMember")}</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="titleMedium">{target?.display_name ?? ""}</Text>
        {extraMessage ? <Text>{extraMessage}</Text> : null}
        {loading ? (
          <View style={styles.formRow}>
            <ActivityIndicator />
            <Text>{t("group.removeMember.checkingOutstanding")}</Text>
          </View>
        ) : null}
        {hasOutstanding && outstanding ? (
          <>
            <HelperText type="info" visible>
              {t("group.removeMember.convertWarning", { name: target?.display_name ?? "" })}
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
        <Button onPress={onConfirm}>{confirmLabel ?? t("common.delete")}</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function OutstandingLine({ row, currency }: Readonly<{ row: OutstandingRow; currency: string }>) {
  return (
    <List.Item
      title={row.display_name}
      left={renderOutstandingAvatar(row.display_name, row.avatar_url)}
      right={renderOutstandingAmount(row.amount, currency)}
    />
  );
}

function renderOutstandingAvatar(name: string, imageUrl: string) {
  return function OutstandingAvatarRenderer() {
    return <PersonAvatar name={name} imageUrl={imageUrl} size={36} />;
  };
}

function renderOutstandingAmount(amount: string, currency: string) {
  return function OutstandingAmountRenderer() {
    return (
      <View style={styles.listTileRight}>
        <MoneyText plain amount={amount} currency={currency} />
      </View>
    );
  };
}
