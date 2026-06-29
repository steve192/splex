export type StatisticsPeriod = "all" | "last12" | "thisMonth" | "lastMonth" | "custom";

export interface StatisticsDateRange {
  date_from?: string;
  date_to?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDateParam(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function statisticsRangeForPeriod(
  period: StatisticsPeriod,
  today: Date = new Date(),
  customRange: StatisticsDateRange = {}
): StatisticsDateRange {
  if (period === "all") {
    return {};
  }
  if (period === "custom") {
    return {
      date_from: customRange.date_from?.trim() || undefined,
      date_to: customRange.date_to?.trim() || undefined
    };
  }
  if (period === "thisMonth") {
    return {
      date_from: toDateParam(monthStart(today)),
      date_to: toDateParam(monthEnd(today))
    };
  }
  if (period === "lastMonth") {
    const lastMonth = addMonths(today, -1);
    return {
      date_from: toDateParam(monthStart(lastMonth)),
      date_to: toDateParam(monthEnd(lastMonth))
    };
  }
  return {
    date_from: toDateParam(addMonths(monthStart(today), -11)),
    date_to: toDateParam(today)
  };
}

export function statisticsEndpointWithRange(endpoint: string, range: StatisticsDateRange): string {
  const params = new URLSearchParams();
  if (range.date_from) params.set("date_from", range.date_from);
  if (range.date_to) params.set("date_to", range.date_to);
  const query = params.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

export function signedAmountLabel(amount: string, formatter: (amount: string) => string): string {
  const value = Number(amount);
  if (value > 0) return `+${formatter(amount)}`;
  return formatter(amount);
}
