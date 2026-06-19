import { View } from "react-native";
import { Card, Divider, Text, TouchableRipple } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { styles } from "../../shared/ui/styles";

type OptionSheet = "context" | "date" | "payer" | "split";

type ExpenseOptionsCardProps = {
  contextName?: string;
  hasContext: boolean;
  date: string;
  payerLabel: string;
  splitLabel: string;
  onOpen: (sheet: OptionSheet) => void;
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
  disabled = false,
}: Readonly<ExpenseOptionsCardProps>) {
  const { t } = useI18n();
  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content style={styles.optionRowCard}>
        <TouchableRipple
          style={styles.optionRow}
          disabled={disabled}
          onPress={disabled ? undefined : () => onOpen("context")}
        >
          <View style={styles.rowBetween}>
            <Text variant="titleMedium">{t("expense.contextLabel")}</Text>
            <Text variant="bodyMedium">{contextName ?? t("expense.contextChoose")}</Text>
          </View>
        </TouchableRipple>
        {hasContext ? (
          <>
            <Divider />
            <TouchableRipple
              style={styles.optionRow}
              disabled={disabled}
              onPress={disabled ? undefined : () => onOpen("date")}
            >
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{t("expense.date")}</Text>
                <Text variant="bodyMedium">{date || t("common.today")}</Text>
              </View>
            </TouchableRipple>
            <Divider />
            <TouchableRipple
              style={styles.optionRow}
              disabled={disabled}
              onPress={disabled ? undefined : () => onOpen("payer")}
            >
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{t("expense.paidBy")}</Text>
                <Text variant="bodyMedium">{payerLabel}</Text>
              </View>
            </TouchableRipple>
            <Divider />
            <TouchableRipple
              style={styles.optionRow}
              disabled={disabled}
              onPress={disabled ? undefined : () => onOpen("split")}
            >
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{t("expense.split")}</Text>
                <Text variant="bodyMedium">{splitLabel}</Text>
              </View>
            </TouchableRipple>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}
