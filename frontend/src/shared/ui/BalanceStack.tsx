import { Fragment } from "react";
import { Text, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { asNumber, formatMoney } from "../lib/money";
import { negativeColor, positiveColor } from "./colors";

type BalanceStackProps = {
  amount: string | number | undefined;
  currency: string;
};

/**
 * Two-line balance display: a small "You owe / You are owed / Settled" label
 * on top of the bold signed amount, both tinted by sign (red / green /
 * neutral). The caller provides the wrapping View with whatever alignment it
 * needs (e.g. styles.expenseNet, styles.listTileRight).
 */
export function BalanceStack({ amount, currency }: Readonly<BalanceStackProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const numeric = asNumber(amount);
  let color: string;
  let label: string;
  if (numeric > 0) {
    color = positiveColor(theme);
    label = t("balance.owedToYou");
  } else if (numeric < 0) {
    color = negativeColor(theme);
    label = t("balance.youOwe");
  } else {
    color = theme.colors.onSurfaceVariant;
    label = t("balance.settled");
  }

  return (
    <Fragment>
      <Text variant="bodySmall" style={{ color }}>{label}</Text>
      <Text variant="titleSmall" style={{ color, fontWeight: "700" }}>
        {numeric === 0 ? "" : `${formatMoney(numeric)} ${currency}`}
      </Text>
    </Fragment>
  );
}
