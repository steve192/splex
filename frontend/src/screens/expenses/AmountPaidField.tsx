import { useEffect, useState } from "react";
import { View } from "react-native";
import { HelperText } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import {
  conversionRate,
  formatExchangeRate,
} from "../../shared/currency/conversion";
import { loadCurrencyRates } from "../../shared/currency/rates";
import { useI18n } from "../../shared/i18n/I18nContext";
import type { CurrencyCode } from "../../shared/lib/currencies";
import { plainAmountText } from "../../shared/lib/money";
import type { Expense } from "../../shared/types/models";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import {
  amountPaidNeedsReview,
  amountPaidRate,
  formOfficialRate,
  officialEstimate,
  rateComparison,
  type AmountPaidFieldState,
} from "./amountPaidModel";
import { normalizeExpenseAmountInput } from "./expenseFormLogic";

type AmountPaidFieldProps = Readonly<{
  fieldState: Exclude<AmountPaidFieldState, { kind: "hidden" }>;
  amount: string;
  currency: CurrencyCode;
  date: string;
  loadedExpense: Expense | null;
  value: string;
  disabled: boolean;
  onChangeText: (value: string) => void;
}>;

export function AmountPaidField({
  fieldState,
  amount,
  currency,
  date,
  loadedExpense,
  value,
  disabled,
  onChangeText,
}: AmountPaidFieldProps) {
  const { t, locale } = useI18n();
  const { api } = useAuth();
  const [rates, setRates] = useState<Record<string, string> | null>(null);
  const { contextCurrency } = fieldState;

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

  if (fieldState.kind === "singlePayerOnly") {
    return (
      <HelperText type="info">{t("expense.amountPaidSinglePayerOnly")}</HelperText>
    );
  }

  const rate = amountPaidRate(amount, value);
  const officialRate = formOfficialRate({
    loadedExpense,
    currency,
    contextCurrency,
    date,
    latestRate: rates ? conversionRate(currency, contextCurrency, rates) : null,
  });
  const comparison =
    rate !== null && officialRate !== null
      ? rateComparison(rate, officialRate, locale)
      : null;
  const estimate = officialEstimate(amount, officialRate);

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
            {t("currency.rate", {
              from: currency,
              rate: formatExchangeRate(rate, locale),
              to: contextCurrency,
            })}
          </HelperText>
          {comparison ? (
            <HelperText type={comparison.suspicious ? "error" : "info"}>
              {t(comparison.key, { percent: comparison.percent })}
            </HelperText>
          ) : null}
          {comparison?.suspicious ? (
            <HelperText type="error">{t("expense.amountPaidCheck")}</HelperText>
          ) : null}
          {amountPaidNeedsReview({ loadedExpense, amount, amountPaid: value }) ? (
            <HelperText type="info">
              {t("expense.amountPaidNeedsReview")}
            </HelperText>
          ) : null}
        </>
      )}
    </View>
  );
}
