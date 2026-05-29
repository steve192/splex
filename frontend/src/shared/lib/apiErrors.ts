import { TranslateFn } from "../i18n/I18nContext";

/**
 * Pick the most useful user-facing string out of a thrown value.
 *
 * Anything that's a real ``Error`` with a non-empty ``message`` (this
 * includes ``ApiError`` from the API client, which puts the backend's
 * ``detail`` field into ``message``) wins.  Otherwise we fall back to the
 * translated generic "something went wrong" string so a stray non-Error
 * throw never leaves the user staring at an empty snackbar.
 */
export function apiErrorMessage(error: unknown, t: TranslateFn): string {
  if (error instanceof Error && error.message) return error.message;
  return t("common.error");
}
