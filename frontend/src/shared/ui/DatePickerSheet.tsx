import { DatePickerModal } from "react-native-paper-dates";

import { useI18n } from "../i18n/I18nContext";

function parseDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function DatePickerSheet({
  visible,
  value,
  title,
  onSelect,
  onDismiss
}: {
  visible: boolean;
  value?: string;
  title: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}) {
  const { locale, t } = useI18n();

  return (
    <DatePickerModal
      locale={locale === "de" ? "de" : "en"}
      mode="single"
      visible={visible}
      date={parseDate(value)}
      onDismiss={onDismiss}
      label={title}
      saveLabel={t("common.done")}
      animationType="slide"
      onConfirm={({ date }) => {
        if (date) onSelect(isoDate(date));
        onDismiss();
      }}
    />
  );
}
