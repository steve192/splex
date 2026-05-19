import { View } from "react-native";
import { Button, Checkbox, List, Modal, Portal, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { formatMoney } from "../../shared/lib/money";
import { Participant, SplitMethod } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";
import { currencyAmount, SPLIT_TOLERANCE } from "./expenseFormLogic";

type SplitTab = "equal" | "exact" | "percentage" | "adjusted_equal";

type SplitSheetProps = {
  visible: boolean;
  participants: Participant[];
  currentParticipantId: number | null;
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
  tabValue: SplitTab;
  splitConfigInvalid: boolean;
  exactLeft: number;
  percentageLeft: number;
  adjustmentSum: number;
  totalAmount: number;
  currency: string;
  perMemberShare: (participantId: number) => number;
  onDismiss: () => void;
  onSplitMethodChange: (method: SplitMethod) => void;
  onEnsureParticipants: () => void;
  onToggleParticipant: (participantId: number) => void;
  onSplitValueChange: (participantId: number, value: string) => void;
};

export function SplitSheet({
  visible,
  participants,
  currentParticipantId,
  selectedParticipantIds,
  splitValues,
  tabValue,
  splitConfigInvalid,
  exactLeft,
  percentageLeft,
  adjustmentSum,
  totalAmount,
  currency,
  perMemberShare,
  onDismiss,
  onSplitMethodChange,
  onEnsureParticipants,
  onToggleParticipant,
  onSplitValueChange
}: SplitSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const errorStyle = { color: negativeColor(theme) };

  function nameFor(participant: Participant) {
    return participant.id === currentParticipantId ? t("common.you") : participant.display_name;
  }

  function splitStatus() {
    if (tabValue === "equal") return null;
    if (tabValue === "exact") {
      return (
        <Text variant="bodyMedium" style={Math.abs(exactLeft) > SPLIT_TOLERANCE ? errorStyle : undefined}>
          {t("expense.amountLeft", { amount: currencyAmount(exactLeft, currency) })}
        </Text>
      );
    }
    if (tabValue === "percentage") {
      return (
        <Text variant="bodyMedium" style={Math.abs(percentageLeft) > SPLIT_TOLERANCE ? errorStyle : undefined}>
          {t("expense.percentageLeft", { amount: `${formatMoney(percentageLeft)}%` })}
        </Text>
      );
    }
    if (Math.abs(adjustmentSum) <= SPLIT_TOLERANCE) return null;
    if (Math.abs(adjustmentSum) > totalAmount + SPLIT_TOLERANCE) {
      return <Text style={errorStyle}>{t("expense.adjustmentOverTotal")}</Text>;
    }
    return (
      <Text style={errorStyle}>
        {t("expense.adjustmentMustZero", { amount: currencyAmount(adjustmentSum, currency) })}
      </Text>
    );
  }

  function renderSplitMemberRow(participant: Participant) {
    const selected = selectedParticipantIds.includes(participant.id);
    const memberShare = perMemberShare(participant.id);
    const showInput = tabValue !== "equal";
    const suffix = tabValue === "percentage" ? "%" : currency;

    return (
      <List.Item
        key={participant.id}
        style={styles.listTile}
        title={nameFor(participant)}
        description={t("expense.memberPays", { amount: currencyAmount(memberShare, currency) })}
        onPress={tabValue === "equal" ? () => onToggleParticipant(participant.id) : undefined}
        left={() => (
          <View style={styles.inline}>
            <Checkbox.Android
              status={selected ? "checked" : "unchecked"}
              onPress={() => onToggleParticipant(participant.id)}
            />
            <PersonAvatar name={nameFor(participant)} imageUrl={participant.avatar_url} />
          </View>
        )}
        right={() =>
          showInput ? (
            <TextInput
              mode="outlined"
              dense
              style={styles.splitRowInput}
              keyboardType="decimal-pad"
              value={splitValues[participant.id] ?? ""}
              disabled={!selected}
              onChangeText={(value) => onSplitValueChange(participant.id, value)}
              right={<TextInput.Affix text={suffix} />}
            />
          ) : null
        }
      />
    );
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}
        style={styles.bottomSheetWrapper}
      >
        <View style={[styles.bottomSheetHandle, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={styles.rowBetween}>
          <Text variant="titleLarge">{t("expense.split")}</Text>
          <Button disabled={splitConfigInvalid} onPress={onDismiss}>
            {t("common.done")}
          </Button>
        </View>
        <SegmentedButtons
          value={tabValue}
          onValueChange={(value) => {
            const method = value === "equal" ? "equal_all" : (value as SplitMethod);
            onSplitMethodChange(method);
            onEnsureParticipants();
          }}
          buttons={[
            { value: "equal", label: t("split.shortEqual") },
            { value: "exact", label: t("split.shortExact") },
            { value: "percentage", label: t("split.shortPercentage") },
            { value: "adjusted_equal", label: t("split.shortAdjusted") }
          ]}
        />
        {splitStatus()}
        <View style={styles.gap}>{participants.map((participant) => renderSplitMemberRow(participant))}</View>
      </Modal>
    </Portal>
  );
}
