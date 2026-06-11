function dateFromDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
}

export function formatDeviceDate(value?: string): string {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFromDateOnly(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function formatDeviceDateParts(value?: string): { month: string; day: string } {
  let date: Date;
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date = dateFromDateOnly(value);
  } else if (value) {
    date = new Date(value);
  } else {
    date = new Date();
  }
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(safeDate).toUpperCase(),
    day: new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(safeDate)
  };
}
