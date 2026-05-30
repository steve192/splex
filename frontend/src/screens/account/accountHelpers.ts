import { type Locale } from '../../shared/i18n/locale';

const normalizeDeleteConfirmation = (value: string, locale: Locale): string => {
  return value.trim().toLocaleUpperCase(locale);
};

export const isDeleteConfirmationMatch = (
  input: string,
  keyword: string,
  locale: Locale
): boolean => {
  return normalizeDeleteConfirmation(input, locale) === normalizeDeleteConfirmation(keyword, locale);
};