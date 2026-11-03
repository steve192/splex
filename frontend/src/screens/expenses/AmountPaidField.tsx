import { useEffect, useState } from "react";
import { View } from "react-native";
import { HelperText } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import {
  conversionRate,
  convertedAmount,
  exchangeRateText,
  formatExchangeRate,
} from "../../shared/currency/conversion";
import { loadCurrencyRates } from "../../shared/currency/rates";
import { useI18n } from "../../shared/i18n/I18nContext";
import type { CurrencyCode } from "../../shared/lib/currencies";
import { plainAmountText } from "../../shared/lib/money";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import {
  amountPaidRate,
  rateComparison,
  type AmountPaidFieldState,
} from "./amountPaidModel";
import { normalizeExpenseAmountInput } from "./expenseFormLogic";

type AmountPaidFieldProps = Readonly<{
  state: Exclude<AmountPaidFieldState, "hidden">;
  amount: string;
  currency: CurrencyCode;
  contextCurrency: CurrencyCode;
  value: string;
  needsReview: boolean;
  disabled: boolean;
  onChangeText: (value: string) => void;
}>;

export function AmountPaidField({
  state,
  amount,
  currency,
  contextCurrency,
  value,
  needsReview,
  disabled,
  onChangeText,
}: AmountPaidFieldProps) {
  const { t, locale } = useI18n();
  const { api } = useAuth();
  const [rates, setRates] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let active = true;
    loadCurrencyRates(api)
      .then(({ snapshot }) => {
        if (active) setRates(snapshot?.rates ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api]);

  if (state === "singlePayerOnly") {
    return (
      <HelperText type="info">{t("expense.amountPaidSinglePayerOnly")}</HelperText>
    );
  }

  const rate = amountPaidRate(amount, value);
  const officialRate = rates
    ? conversionRate(currency, contextCurrency, rates)
    : null;
  const comparison =
    rate !== null && officialRate !== null
      ? rateComparison(rate, officialRate, locale)
      : null;
  const estimate = rates
    ? convertedAmount(amount, currency, contextCurrency, rates)
    : null;

  return (
    <View>
      <MoneyAmountInput
        mode="outlined"
        label={t("expense.amountPaid", { currency: contextCurrency })}
        value={value}
        disabled={disabled}
        onChangeText={(text) => onChangeText(normalizeExpenseAmountInput(text))}
      />
      {rate === null ? (
        <>
          <HelperText type="info">{t("expense.amountPaidHelp")}</HelperText>
          {estimate !== null ? (
            <HelperText type="info">
              {t("expense.amountPaidEstimate", {
                amount: plainAmountText(estimate, contextCurrency),
              })}
            </HelperText>
          ) : null}
        </>
      ) : (
        <>
          <HelperText type="info">
            {exchangeRateText(
              currency,
              formatExchangeRate(rate, locale),
              contextCurrency,
            )}
          </HelperText>
          {comparison ? (
            <HelperText type={comparison.suspicious ? "error" : "info"}>
              {t(comparison.key, { percent: comparison.percent })}
            </HelperText>
          ) : null}
          {comparison?.suspicious ? (
            <HelperText type="error">{t("expense.amountPaidCheck")}</HelperText>
          ) : null}
          {needsReview ? (
            <HelperText type="info">
              {t("expense.amountPaidNeedsReview")}
            </HelperText>
          ) : null}
        </>
      )}
    </View>
  );
}
