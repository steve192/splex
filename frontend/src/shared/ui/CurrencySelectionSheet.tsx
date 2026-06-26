import { useMemo } from "react";

import { useI18n } from "../i18n/I18nContext";
import {
  currencyCodeOrFallback,
  currencySelectionOptions,
  type CurrencyCode,
} from "../lib/currencies";
import { SelectionSheet } from "./SelectionSheet";

type CurrencySelectionSheetProps = Readonly<{
  visible: boolean;
  title: string;
  value: string | null | undefined;
  onSelect: (currency: CurrencyCode) => void;
  onDismiss: () => void;
}>;

export function CurrencySelectionSheet({
  visible,
  title,
  value,
  onSelect,
  onDismiss,
}: CurrencySelectionSheetProps) {
  const { locale } = useI18n();
  const options = useMemo(() => currencySelectionOptions(locale), [locale]);

  return (
    <SelectionSheet
      visible={visible}
      title={title}
      options={options}
      searchable
      value={currencyCodeOrFallback(value)}
      onSelect={onSelect}
      onDismiss={onDismiss}
    />
  );
}
