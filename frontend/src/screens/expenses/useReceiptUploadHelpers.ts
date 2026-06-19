import { ApiError } from "../../shared/api/client";
import type { TranslateFn } from "../../shared/i18n/I18nContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";

export function receiptUploadErrorMessage(error: unknown, t: TranslateFn): string {
  if (error instanceof ApiError && !error.offline && error.status === undefined) {
    return t("receipts.uploadFailed");
  }
  return apiWriteErrorMessage(error, t);
}
