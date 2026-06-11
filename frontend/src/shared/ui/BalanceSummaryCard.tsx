import { ReactNode } from "react";
import { Card, Text, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { formatMoney } from "../lib/money";
import { negativeColor, positiveColor } from "./colors";
import { styles } from "./styles";

type BalanceSummaryCardProps = {
  total: number;
  currency: string;
  detailLines: ReactNode;
};

export function BalanceSummaryCard({ total, currency, detailLines }: Readonly<BalanceSummaryCardProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  if (total === 0) {
    return (
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <Text variant="titleLarge" style={[{ color: theme.colors.onSurfaceVariant }, styles.bold]}>
            {t("balance.summarySettled")}
          </Text>
        </Card.Content>
      </Card>
    );
  }
  const positive = total > 0;
  const color = positive ? positiveColor(theme) : negativeColor(theme);
  return (
    <Card mode="elevated" style={styles.card}>
      <Card.Content style={styles.gap}>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          {positive ? t("balance.summaryGetting") : t("balance.summaryOweTotal")}{" "}
          <Text variant="titleLarge" style={[{ color }, styles.bold]}>
            {formatMoney(total)} {currency}
          </Text>
        </Text>
        {detailLines}
      </Card.Content>
    </Card>
  );
}

type BalanceLineProps = {
  variant: "incoming" | "outgoing";
  person: string;
  amount: string;
  currency: string;
};

export function BalanceLine({ variant, person, amount, currency }: Readonly<BalanceLineProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const positive = variant === "incoming";
  const color = positive ? positiveColor(theme) : negativeColor(theme);
  const key = positive ? "balance.summaryOwesYou" : "balance.summaryYouOwe";
  return (
    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
      {t(key, { person })}{" "}
      <Text variant="bodyMedium" style={[{ color }, styles.bold]}>
        {amount} {currency}
      </Text>
    </Text>
  );
}
