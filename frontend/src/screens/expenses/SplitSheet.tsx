import { View } from "react-native";
import { Button, Checkbox, List, Modal, Portal, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";

import { Participant, SplitMethod } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";

type SplitSheetProps = {
  visible: boolean;
  participants: Participant[];
  selectedParticipantIds: number[];
  splitValues: Record<number, string>;
  tabValue: "equal" | "exact" | "percentage" | "adjusted_equal";
  splitConfigInvalid: boolean;
  exactLeft: number;
  percentageLeft: number;
  adjustmentSum: number;
  totalAmount: number;
  currency: string;
  surfaceColor: string;
  handleColor: string;
  t: (key: string) => string;
  participantName: (participant: Participant) => string;
  currencyAmount: (value: number, currency: string) => string;
  formatMoney: (value: string | number | undefined) => string;
  perMemberShare: (participantId: number) => number;
  onDismiss: () => void;
  onSplitMethodChange: (method: SplitMethod) => void;
  onEnsureParticipants: () => void;
  onToggleParticipant: (participantId: number) => void;
  onSplitValueChange: (participantId: number, value: string) => void;
};

const TOLERANCE = 0.005;

export function SplitSheet({
  visible,
  participants,
  selectedParticipantIds,
  splitValues,
  tabValue,
  splitConfigInvalid,
  exactLeft,
  percentageLeft,
  adjustmentSum,
  totalAmount,
  currency,
  surfaceColor,
  handleColor,
  t,
  participantName,
  currencyAmount,
  formatMoney,
  perMemberShare,
  onDismiss,
  onSplitMethodChange,
  onEnsureParticipants,
  onToggleParticipant,
  onSplitValueChange
}: SplitSheetProps) {
  const theme = useTheme();
  const errorStyle = { color: negativeColor(theme) };

  function splitStatus() {
    if (tabValue === "equal") return null;
    if (tabValue === "exact") {
      return (
        <Text variant="bodyMedium" style={Math.abs(exactLeft) > TOLERANCE ? errorStyle : undefined}>
          {t("expense.amountLeft").replace("{amount}", currencyAmount(exactLeft, currency))}
        </Text>
      );
    }
    if (tabValue === "percentage") {
      return (
        <Text variant="bodyMedium" style={Math.abs(percentageLeft) > TOLERANCE ? errorStyle : undefined}>
          {t("expense.percentageLeft").replace("{amount}", `${formatMoney(percentageLeft)}%`)}
        </Text>
      );
    }
    if (Math.abs(adjustmentSum) <= TOLERANCE) return null;
    if (Math.abs(adjustmentSum) > totalAmount + TOLERANCE) {
      return <Text style={errorStyle}>{t("expense.adjustmentOverTotal")}</Text>;
    }
    return (
      <Text style={errorStyle}>
        {t("expense.adjustmentMustZero").replace("{amount}", currencyAmount(adjustmentSum, currency))}
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
        title={participantName(participant)}
        description={t("expense.memberPays").replace("{amount}", currencyAmount(memberShare, currency))}
        onPress={tabValue === "equal" ? () => onToggleParticipant(participant.id) : undefined}
        left={() => (
          <View style={styles.inline}>
            <Checkbox.Android
              status={selected ? "checked" : "unchecked"}
              onPress={() => onToggleParticipant(participant.id)}
            />
            <PersonAvatar name={participantName(participant)} imageUrl={participant.avatar_url} />
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
        contentContainerStyle={[styles.bottomSheet, { backgroundColor: surfaceColor }]}
        style={styles.bottomSheetWrapper}
      >
        <View style={[styles.bottomSheetHandle, { backgroundColor: handleColor }]} />
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
