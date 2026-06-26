export const CURRENCIES = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD",
  "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNH", "CNY",
  "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GGP", "GHS", "GIP",
  "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS",
  "IMP", "INR", "IQD", "IRR", "ISK", "JEP", "JMD", "JOD", "JPY", "KES",
  "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP",
  "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT",
  "MOP", "MRO", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD",
  "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP",
  "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD",
  "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN",
  "SVC", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD",
  "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV",
  "WST", "XAF", "XAG", "XAU", "XCD", "XCG", "XDR", "XOF", "XPD", "XPF",
  "XPT", "YER", "ZAR", "ZMW", "ZWG",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.includes(value as CurrencyCode);
}

export function currencyCodeOrFallback(value: string | null | undefined, fallback: CurrencyCode = "EUR"): CurrencyCode {
  return value && isCurrencyCode(value) ? value : fallback;
}

export function currencyDisplayName(currency: CurrencyCode, locale: string): string {
  if (typeof Intl.DisplayNames !== "function") return currency;
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export function currencySelectionOptions(locale: string) {
  return CURRENCIES.map((currency) => ({
    value: currency,
    label: currency,
    description: currencyDisplayName(currency, locale),
  }));
}
