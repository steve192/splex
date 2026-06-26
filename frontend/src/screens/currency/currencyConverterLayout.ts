export const CURRENCY_RATES_COMPACT_WIDTH = 420;

export function shouldStackCurrencyRatesInfo(width: number): boolean {
  return width < CURRENCY_RATES_COMPACT_WIDTH;
}
