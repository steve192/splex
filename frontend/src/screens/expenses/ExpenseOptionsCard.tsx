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
};

/** The context / date / paid-by / split summary rows of the expense form. */
export function ExpenseOptionsCard({
  contextName,
  hasContext,
  date,
  payerLabel,
  splitLabel,
  onOpen
}: Readonly<ExpenseOptionsCardProps>) {
  const { t } = useI18n();
  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content style={styles.optionRowCard}>
        <TouchableRipple style={styles.optionRow} onPress={() => onOpen("context")}>
          <View style={styles.rowBetween}>
            <Text variant="titleMedium">{t("expense.contextLabel")}</Text>
            <Text variant="bodyMedium">{contextName ?? t("expense.contextChoose")}</Text>
          </View>
        </TouchableRipple>
        {hasContext ? (
          <>
            <Divider />
            <TouchableRipple style={styles.optionRow} onPress={() => onOpen("date")}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{t("expense.date")}</Text>
                <Text variant="bodyMedium">{date || t("common.today")}</Text>
              </View>
            </TouchableRipple>
            <Divider />
            <TouchableRipple style={styles.optionRow} onPress={() => onOpen("payer")}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{t("expense.paidBy")}</Text>
                <Text variant="bodyMedium">{payerLabel}</Text>
              </View>
            </TouchableRipple>
            <Divider />
            <TouchableRipple style={styles.optionRow} onPress={() => onOpen("split")}>
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
