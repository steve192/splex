import { View } from "react-native";
import {
  Card,
  Divider,
  IconButton,
  Text,
  TouchableRipple,
} from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { styles } from "../../shared/ui/styles";
import {
  expenseOptionRows,
  type ExpenseOptionRow,
  type OptionSheet,
} from "./expenseOptionsCardModel";

type ExpenseOptionsCardProps = {
  contextName?: string;
  hasContext: boolean;
  date: string;
  payerLabel: string;
  splitLabel: string;
  onOpen: (sheet: OptionSheet) => void;
  contextEditable?: boolean;
  showContextInfo?: boolean;
  onShowContextInfo?: () => void;
  disabled?: boolean;
};

/** The context / date / paid-by / split summary rows of the expense form. */
export function ExpenseOptionsCard({
  contextName,
  hasContext,
  date,
  payerLabel,
  splitLabel,
  onOpen,
  contextEditable = true,
  showContextInfo = false,
  onShowContextInfo,
  disabled = false,
}: Readonly<ExpenseOptionsCardProps>) {
  const { t } = useI18n();
  const contextDisabled = disabled || !contextEditable;
  const rows = expenseOptionRows({ hasContext, date, payerLabel, splitLabel, t });

  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content style={styles.optionRowCard}>
        <View style={styles.optionRowWithAction}>
          <TouchableRipple
            style={styles.optionRowContent}
            disabled={contextDisabled}
            onPress={contextDisabled ? undefined : () => onOpen("context")}
          >
            <View style={styles.rowBetween}>
              <Text variant="titleMedium">{t("expense.contextLabel")}</Text>
              <Text variant="bodyMedium">
                {contextName ?? t("expense.contextChoose")}
              </Text>
            </View>
          </TouchableRipple>
          {showContextInfo ? (
            <IconButton
              icon="information-outline"
              accessibilityLabel={t("expense.contextMoveInfoButton")}
              onPress={onShowContextInfo}
            />
          ) : null}
        </View>
        {rows.map((row) => (
          <ExpenseOptionsRow
            key={row.sheet}
            row={row}
            disabled={disabled}
            onOpen={onOpen}
          />
        ))}
      </Card.Content>
    </Card>
  );
}

function ExpenseOptionsRow({
  row,
  disabled,
  onOpen,
}: Readonly<{
  row: ExpenseOptionRow;
  disabled: boolean;
  onOpen: (sheet: OptionSheet) => void;
}>) {
  return (
    <>
      <Divider />
      <TouchableRipple
        style={styles.optionRow}
        disabled={disabled}
        onPress={disabled ? undefined : () => onOpen(row.sheet)}
      >
        <View style={styles.rowBetween}>
          <Text variant="titleMedium">{row.label}</Text>
          <Text variant="bodyMedium">{row.value}</Text>
        </View>
      </TouchableRipple>
    </>
  );
}
