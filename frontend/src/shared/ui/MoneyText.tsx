import { Text, TextProps, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { asNumber, balanceText } from "../lib/money";
import { negativeColor, positiveColor } from "./colors";
import { styles } from "./styles";

type MoneyTextProps = Omit<TextProps<never>, "children"> & {
  amount: string | number | undefined;
  currency: string;
};

export function MoneyText({ amount, currency, style, ...props }: MoneyTextProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const numeric = asNumber(amount);
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
