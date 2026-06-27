import type { Dispatch, SetStateAction } from "react";
import { Button, Dialog, Portal, Text } from "react-native-paper";

import type { CurrencyCode } from "../../shared/lib/currencies";
import { useI18n } from "../../shared/i18n/I18nContext";
import type {
  ContextOption,
  Friend,
  Group,
  Participant,
  SplitMethod,
} from "../../shared/types/models";
import { CurrencySelectionSheet } from "../../shared/ui/CurrencySelectionSheet";
import { DatePickerSheet } from "../../shared/ui/DatePickerSheet";
import { ContextPickerSheet } from "./ContextPickerSheet";
import { PayerSheet } from "./PayerSheet";
import { SplitSheet } from "./SplitSheet";
import {
  perMemberShare,
  splitTabValue,
  type SplitTab,
} from "./expenseFormLogic";
import type { ActiveSheet } from "./addScreenTypes";

export function AddScreenSheets({
  activeSheet,
  contextArchived,
  currency,
  date,
  participants,
  currentParticipantId,
  multiPayer,
  payerId,
  paymentValues,
  paymentLeft,
  paymentConfigInvalid,
  totalAmount,
  selectedParticipantIds,
  selectedEqualShares,
  splitValues,
  tabValue,
  splitConfigInvalid,
  exactLeft,
  percentageLeft,
  adjustedHasNegativeShare,
  contextEditable,
  pickerGroups,
  pickerFriends,
  calledFromNavigation,
  rememberContext,
  contextMoveInfoVisible,
  onActiveSheetChange,
  onCurrencyChange,
  onDateChange,
  onMultiPayerChange,
  onPayerChange,
  onPaymentValueChange,
  onSplitMethodChange,
  onSplitValuesChange,
  onEnsureParticipants,
  onToggleParticipant,
  onSplitValueChange,
  onSelectContext,
  onToggleRemember,
  onContextMoveInfoVisibleChange,
}: Readonly<{
  activeSheet: ActiveSheet;
  contextArchived: boolean;
  currency: CurrencyCode;
  date: string;
  participants: Participant[];
  currentParticipantId: number | null;
  multiPayer: boolean;
  payerId: number | null;
  paymentValues: Record<number, string>;
  paymentLeft: number;
  paymentConfigInvalid: boolean;
  totalAmount: number;
  selectedParticipantIds: number[];
  selectedEqualShares: Record<number, number>;
  splitValues: Record<number, string>;
  tabValue: SplitTab;
  splitConfigInvalid: boolean;
  exactLeft: number;
  percentageLeft: number;
  adjustedHasNegativeShare: boolean;
  contextEditable: boolean;
  pickerGroups: Group[];
  pickerFriends: Friend[];
  calledFromNavigation: boolean;
  rememberContext: boolean;
  contextMoveInfoVisible: boolean;
  onActiveSheetChange: Dispatch<SetStateAction<ActiveSheet>>;
  onCurrencyChange: Dispatch<SetStateAction<CurrencyCode>>;
  onDateChange: Dispatch<SetStateAction<string>>;
  onMultiPayerChange: Dispatch<SetStateAction<boolean>>;
  onPayerChange: Dispatch<SetStateAction<number | null>>;
  onPaymentValueChange: (participantId: number, value: string) => void;
  onSplitMethodChange: Dispatch<SetStateAction<SplitMethod>>;
  onSplitValuesChange: Dispatch<SetStateAction<Record<number, string>>>;
  onEnsureParticipants: () => void;
  onToggleParticipant: (participantId: number) => void;
  onSplitValueChange: (participantId: number, value: string) => void;
  onSelectContext: (option: ContextOption) => void;
  onToggleRemember: () => void;
  onContextMoveInfoVisibleChange: Dispatch<SetStateAction<boolean>>;
}>) {
  const { t } = useI18n();

  return (
    <>
      <CurrencySelectionSheet
        visible={activeSheet === "currency" && !contextArchived}
        title={t("expense.currency")}
        value={currency}
        onSelect={onCurrencyChange}
        onDismiss={() => onActiveSheetChange(null)}
      />
      <DatePickerSheet
        visible={activeSheet === "date" && !contextArchived}
        value={date}
        title={t("expense.date")}
        onSelect={onDateChange}
        onDismiss={() => onActiveSheetChange(null)}
      />
      <PayerSheet
        visible={activeSheet === "payer" && !contextArchived}
        participants={participants}
        currentParticipantId={currentParticipantId}
        multiPayer={multiPayer}
        payerId={payerId}
        paymentValues={paymentValues}
        paymentLeft={paymentLeft}
        paymentConfigInvalid={paymentConfigInvalid}
        totalAmount={totalAmount}
        currency={currency}
        onDismiss={() => onActiveSheetChange(null)}
        onMultiPayerChange={onMultiPayerChange}
        onPayerChange={onPayerChange}
        onPaymentValueChange={onPaymentValueChange}
      />
      <SplitSheet
        visible={activeSheet === "split" && !contextArchived}
        participants={participants}
        currentParticipantId={currentParticipantId}
        selectedParticipantIds={selectedParticipantIds}
        splitValues={splitValues}
        tabValue={tabValue}
        splitConfigInvalid={splitConfigInvalid}
        exactLeft={exactLeft}
        percentageLeft={percentageLeft}
        adjustedHasNegativeShare={adjustedHasNegativeShare}
        currency={currency}
        perMemberShare={(participantId) =>
          perMemberShare({
            participantId,
            tabValue,
            selectedParticipantIds,
            selectedEqualShares,
            splitValues,
            totalAmount,
          })
        }
        onDismiss={() => onActiveSheetChange(null)}
        onSplitMethodChange={(method) => {
          if (splitTabValue(method) !== tabValue) onSplitValuesChange({});
          onSplitMethodChange(method);
        }}
        onEnsureParticipants={onEnsureParticipants}
        onToggleParticipant={onToggleParticipant}
        onSplitValueChange={onSplitValueChange}
      />
      <ContextPickerSheet
        visible={activeSheet === "context" && !contextArchived && contextEditable}
        groups={pickerGroups}
        friends={pickerFriends}
        onSelect={onSelectContext}
        onDismiss={() => onActiveSheetChange(null)}
        showRemember={calledFromNavigation}
        remember={rememberContext}
        onToggleRemember={onToggleRemember}
      />
      <Portal>
        <Dialog
          visible={contextMoveInfoVisible}
          onDismiss={() => onContextMoveInfoVisibleChange(false)}
        >
          <Dialog.Title>{t("expense.contextMoveInfoTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("expense.contextMoveInfoBody")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => onContextMoveInfoVisibleChange(false)}>
              {t("common.ok")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
