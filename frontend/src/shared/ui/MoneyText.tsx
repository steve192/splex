import { Text, TextProps, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { asNumber, balanceText, plainAmountText } from "../lib/money";
import { negativeColor, positiveColor } from "./colors";
import { styles } from "./styles";

type MoneyTextProps = Omit<TextProps<never>, "children"> & {
  amount: string | number | undefined;
  currency: string;
  /**
   * When true, render just `<amount> <currency>` (e.g. "10.00 EUR") in neutral
   * text colour. Use this in contexts where the surrounding UI already tells
   * the user whether they owe or are owed - settlement rows, "X owes" lists,
   * expense breakdown shares.
   */
  plain?: boolean;
};

export function MoneyText({ amount, currency, plain, style, ...props }: MoneyTextProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const numeric = asNumber(amount);
  if (plain) {
    return (
      <Text
        {...props}
        style={[{ color: theme.colors.onSurface }, styles.bold, style]}
      >
        {plainAmountText(amount, currency)}
      </Text>
    );
  }
  const color =
    numeric > 0
      ? positiveColor(theme)
      : numeric < 0
        ? negativeColor(theme)
        : theme.colors.onSurfaceVariant;
  const label = balanceText(t, String(amount ?? 0), currency);
  return (
    <Text {...props} style={[{ color }, styles.bold, style]}>
      {label}
    </Text>
  );
}
