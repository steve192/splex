import AsyncStorage from "@react-native-async-storage/async-storage";

import { isCurrencyCode, type CurrencyCode } from "../../shared/lib/currencies";

const CURRENCY_CONVERTER_PAIR_KEY = "splex.currencyConverter.currencyPair";

export type CurrencyConverterCurrencyPair = {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
};

function isCurrencyConverterCurrencyPair(
  value: unknown,
): value is CurrencyConverterCurrencyPair {
  return (
    typeof value === "object" &&
    value !== null &&
    "fromCurrency" in value &&
    "toCurrency" in value &&
    typeof value.fromCurrency === "string" &&
    typeof value.toCurrency === "string" &&
    isCurrencyCode(value.fromCurrency) &&
    isCurrencyCode(value.toCurrency)
  );
}

export async function loadCurrencyConverterCurrencyPair(): Promise<CurrencyConverterCurrencyPair | null> {
  const raw = await AsyncStorage.getItem(CURRENCY_CONVERTER_PAIR_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isCurrencyConverterCurrencyPair(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveCurrencyConverterCurrencyPair(
  pair: CurrencyConverterCurrencyPair,
): Promise<void> {
  await AsyncStorage.setItem(CURRENCY_CONVERTER_PAIR_KEY, JSON.stringify(pair));
}
