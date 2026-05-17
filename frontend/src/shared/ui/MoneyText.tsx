import { Text, TextProps, useTheme } from "react-native-paper";

import { asNumber, balanceText } from "../lib/money";

type MoneyTextProps = Omit<TextProps<never>, "children"> & {
  amount: string | number | undefined;
  currency: string;
  t?: (key: string) => string;
};

export function MoneyText({ amount, currency, t, style, ...props }: MoneyTextProps) {
  const theme = useTheme();
  const numeric = asNumber(amount);
  const color =
    numeric > 0
      ? (theme.dark ? "#7DDC9F" : "#0F7B3A")
      : numeric < 0
        ? (theme.dark ? "#FFB4AB" : "#B3261E")
        : theme.colors.onSurfaceVariant;
  const label = t ? balanceText(t, String(amount ?? 0), currency) : `${numeric.toFixed(2)} ${currency}`;
  return (
    <Text {...props} style={[{ color, fontWeight: "700" }, style]}>
      {label}
    </Text>
  );
}
