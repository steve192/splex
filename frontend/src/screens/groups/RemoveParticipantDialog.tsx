import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Dialog,
  HelperText,
  List,
  Text,
} from "react-native-paper";

import { ApiClient } from "../../shared/api/client";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Participant } from "../../shared/types/models";
import { MoneyText } from "../../shared/ui/MoneyText";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";
import {
  hasBlockingOutstandingBalance,
  removeParticipantWarningKey,
} from "./removeParticipantDialogModel";

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
  /**
   * When the action deletes the whole group (last member leaving) rather than
   * converting the participant to a placeholder, the per-participant balance
   * warning ("they remain as a placeholder…") is wrong, so we suppress it and
   * rely on `extraMessage` to explain the deletion.
   */
  groupWillBeDeleted?: boolean;
  confirming?: boolean;
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
  groupWillBeDeleted,
  confirming = false,
  onDismiss,
  onConfirm,
}: Readonly<RemoveParticipantDialogProps>) {
  const { t } = useI18n();
  const [outstanding, setOutstanding] = useState<OutstandingResponse | null>(
    null,
  );
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
      .get<OutstandingResponse>(
        `/api/groups/${groupId}/participants/${target.id}/outstanding/`,
      )
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

  const hasOutstanding = hasBlockingOutstandingBalance({
    groupWillBeDeleted,
    outstanding,
  });
  const warningKey = removeParticipantWarningKey(target);

  return (
    <Dialog
      visible={visible ?? !!target}
      onDismiss={confirming ? () => undefined : onDismiss}
    >
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
          <OutstandingWarningContent
            outstanding={outstanding}
            targetName={target?.display_name ?? ""}
            warningKey={warningKey}
          />
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button disabled={confirming} onPress={onDismiss}>
          {t("common.cancel")}
        </Button>
        <Button loading={confirming} disabled={confirming} onPress={onConfirm}>
          {confirmLabel ?? t("common.delete")}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function OutstandingWarningContent({
  outstanding,
  targetName,
  warningKey,
}: Readonly<{
  outstanding: OutstandingResponse;
  targetName: string;
  warningKey: string;
}>) {
  const { t } = useI18n();

  return (
    <>
      <HelperText type="info" visible>
        {t(warningKey, { name: targetName })}
      </HelperText>
      <OutstandingRows
        rows={outstanding.owes}
        currency={outstanding.currency}
        title={t("group.removeMember.owesHeader", { name: targetName })}
        keyPrefix="owes"
      />
      <OutstandingRows
        rows={outstanding.owed_by}
        currency={outstanding.currency}
        title={t("group.removeMember.owedByHeader", { name: targetName })}
        keyPrefix="owed"
      />
    </>
  );
}

function OutstandingRows({
  rows,
  currency,
  title,
  keyPrefix,
}: Readonly<{
  rows: OutstandingRow[];
  currency: string;
  title: string;
  keyPrefix: string;
}>) {
  if (rows.length === 0) return null;

  return (
    <View style={styles.gap}>
      <Text variant="titleSmall">{title}</Text>
      {rows.map((row) => (
        <OutstandingLine
          key={`${keyPrefix}-${row.participant_id}`}
          row={row}
          currency={currency}
        />
      ))}
    </View>
  );
}

function OutstandingLine({
  row,
  currency,
}: Readonly<{ row: OutstandingRow; currency: string }>) {
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
