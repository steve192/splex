import { useEffect, useState } from "react";
import { View } from "react-native";
import { HelperText } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { formatExchangeRate } from "../../shared/currency/conversion";
import { loadCurrencyRate } from "../../shared/currency/rates";
import { useI18n } from "../../shared/i18n/I18nContext";
import type { CurrencyCode } from "../../shared/lib/currencies";
import { asNumber, plainAmountText } from "../../shared/lib/money";
import type { Expense } from "../../shared/types/models";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import {
  amountPaidNeedsReview,
  amountPaidRate,
  officialEstimate,
  rateComparison,
  storedOfficialRate,
  type AmountPaidFieldState,
} from "./amountPaidModel";
import { normalizeExpenseAmountInput } from "./expenseFormLogic";

type AmountPaidInputProps = Readonly<{
  amount: string;
  currency: CurrencyCode;
  date: string;
  loadedExpense: Expense | null;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChangeText: (value: string) => void;
}>;

export function AmountPaidField({
  fieldState,
  ...inputProps
}: AmountPaidInputProps &
  Readonly<{
    fieldState: Exclude<AmountPaidFieldState, { kind: "hidden" }>;
  }>) {
  const { t } = useI18n();

  if (fieldState.kind === "singlePayerOnly") {
    return (
      <HelperText type="info">{t("expense.amountPaidSinglePayerOnly")}</HelperText>
    );
  }
  return (
    <AmountPaidInput
      {...inputProps}
      contextCurrency={fieldState.contextCurrency}
    />
  );
}

function AmountPaidInput({
  amount,
  currency,
  contextCurrency,
  date,
  loadedExpense,
  value,
  invalid,
  disabled,
  onChangeText,
}: AmountPaidInputProps & Readonly<{ contextCurrency: CurrencyCode }>) {
  const { t } = useI18n();
  const storedRate = storedOfficialRate({
    loadedExpense,
    currency,
    contextCurrency,
    date,
  });
  const officialRate = useOfficialRate({
    storedRate,
    currency,
    contextCurrency,
    date,
  });

  return (
    <View>
      <MoneyAmountInput
        mode="outlined"
        label={t("expense.amountPaid", { currency: contextCurrency })}
        value={value}
        disabled={disabled}
        onChangeText={(text) => onChangeText(normalizeExpenseAmountInput(text))}
      />
      {invalid ? (
        <HelperText type="error">{t("expense.amountPaidInvalid")}</HelperText>
      ) : (
        <AmountPaidHints
          amount={amount}
          currency={currency}
          contextCurrency={contextCurrency}
          loadedExpense={loadedExpense}
          value={value}
          officialRate={officialRate}
        />
      )}
    </View>
  );
}

function AmountPaidHints({
  amount,
  currency,
  contextCurrency,
  loadedExpense,
  value,
  officialRate,
}: Readonly<{
  amount: string;
  currency: CurrencyCode;
  contextCurrency: CurrencyCode;
  loadedExpense: Expense | null;
  value: string;
  officialRate: number | null;
}>) {
  const { t, locale } = useI18n();
  const rate = amountPaidRate(amount, value);

  if (rate === null) {
    const estimate = officialEstimate(amount, officialRate);
    return (
      <>
        <HelperText type="info">{t("expense.amountPaidHelp")}</HelperText>
        {estimate === null ? null : (
          <HelperText type="info">
            {t("expense.amountPaidEstimate", {
              amount: plainAmountText(estimate, contextCurrency),
            })}
          </HelperText>
        )}
      </>
    );
  }

  const comparison =
    officialRate === null ? null : rateComparison(rate, officialRate, locale);
  return (
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
        <HelperText type="info">{t("expense.amountPaidNeedsReview")}</HelperText>
      ) : null}
    </>
  );
}

/** The stored official rate, or the one the backend will apply for this date. */
function useOfficialRate({
  storedRate,
  currency,
  contextCurrency,
  date,
}: Readonly<{
  storedRate: number | null;
  currency: CurrencyCode;
  contextCurrency: CurrencyCode;
  date: string;
}>): number | null {
  const { api } = useAuth();
  const [datedRate, setDatedRate] = useState<number | null>(null);

  useEffect(() => {
    setDatedRate(null);
    if (storedRate !== null) return;
    let active = true;
    loadCurrencyRate(api, {
      baseCurrency: currency,
      quoteCurrency: contextCurrency,
      date,
    })
      .then((rate) => {
        if (active) setDatedRate(asNumber(rate.rate));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api, contextCurrency, currency, date, storedRate]);

  return storedRate ?? datedRate;
}
