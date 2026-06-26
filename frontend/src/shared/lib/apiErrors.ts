import { ApiError } from "../api/client";
import { TranslateFn } from "../i18n/I18nContext";

const API_ERROR_TRANSLATION_KEYS: Record<string, string> = {
  auth_email_send_failed: "auth.sendFailed",
  auth_google_failed: "auth.googleFailed",
  auth_login_code_invalid: "auth.codeFailed",
  auth_login_token_invalid: "auth.linkFailed",
  auth_registration_disabled: "auth.registrationDisabled",
  authentication_failed: "apiError.authenticationRequired",
  api_error: "common.error",
  currency_rate_unavailable: "apiError.currencyRateUnavailable",
  expense_access_denied: "expense.accessDenied",
  expense_adjustment_negative: "expense.adjustmentNegativeShare",
  expense_context_required: "expense.contextRequired",
  expense_friend_move_forbidden: "expense.friendMoveForbidden",
  expense_move_group_only: "expense.moveGroupOnly",
  expense_percentage_invalid: "expense.percentagesInvalid",
  expense_shares_invalid: "expense.sharesInvalid",
  expense_split_unsupported: "expense.splitUnsupported",
  expense_target_group_invalid: "expense.targetGroupInvalid",
  expense_target_participants_missing: "expense.contextMoveInfoBody",
  friend_not_settled: "friend.removeBlocked",
  friend_self: "friend.self",
  group_already_member: "group.alreadyMember",
  group_currency_locked: "group.currencyLocked",
  group_deleted: "group.deletedReadOnly",
  group_existing_friend_required: "group.existingFriendRequired",
  group_member_required: "group.memberRequired",
  group_not_settled: "group.deleteBlocked",
  group_participant_already_member: "group.participantAlreadyMember",
  group_participant_inactive: "group.participantInactive",
  group_participant_not_member: "group.participantNotMember",
  group_remove_self: "group.removeSelf",
  group_rename_registered: "group.renameRegistered",
  image_invalid: "image.invalid",
  image_too_large: "image.tooLarge",
  image_type_unsupported: "image.typeUnsupported",
  imports_disabled: "importFromService.disabledByServer",
  invitation_invalid: "invite.invalid",
  location_coordinates_invalid: "location.coordinatesInvalid",
  method_not_allowed: "apiError.methodNotAllowed",
  not_authenticated: "apiError.authenticationRequired",
  not_found: "apiError.notFound",
  payment_method_invalid: "paymentMethods.invalid",
  permission_denied: "apiError.permissionDenied",
  receipt_context_required: "receipts.contextRequired",
  receipt_delete_forbidden: "receipts.deleteForbidden",
  receipt_empty: "receipts.emptyFile",
  receipt_file_required: "receipts.fileRequired",
  receipt_quota_exceeded: "receipts.quotaExceeded",
  receipt_too_large: "receipts.tooLarge",
  receipt_type_invalid: "receipts.typeInvalid",
  reminder_self: "settlement.reminderSelf",
  reminder_target_not_in_debt: "settlement.reminderNotInDebt",
  reminder_target_unregistered: "settlement.reminderUnregistered",
  settlement_deleted: "settlement.deletedReadOnly",
  settlement_participant_invalid: "settlement.participantInvalid",
  settlement_participants_equal: "settlement.participantsEqual",
  split_pro_auth_failed: "splitProImport.connectionFailed",
  split_pro_connection_failed: "splitProImport.connectionFailed",
  split_pro_schema_invalid: "splitProImport.schemaInvalid",
  split_pro_user_not_found: "splitProImport.userNotFound",
  splitwise_auth_failed: "splitwiseImport.invalidKey",
  splitwise_failed: "splitwiseImport.failed",
  sync_mutation_invalid: "sync.mutationInvalid",
  sync_mutation_unsupported: "sync.mutationUnsupported",
  throttled: "apiError.throttled",
  unsupported_media_type: "apiError.unsupportedMediaType",
  validation_error: "apiError.validation"
};

export type ApiErrorDescriptor = {
  code?: string;
  message?: string;
  offline?: boolean;
  params?: Record<string, string | number>;
  status?: number;
};

export function apiErrorDescriptor(error: unknown): ApiErrorDescriptor {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message || undefined,
      offline: error.offline || undefined,
      params: error.params,
      status: error.status
    };
  }
  if (error instanceof Error && error.message) return { message: error.message };
  return {};
}

export function apiErrorDescriptorMessage(
  descriptor: ApiErrorDescriptor | string | undefined,
  t: TranslateFn,
  options: { write?: boolean } = {}
): string {
  const error = typeof descriptor === "string" ? { message: descriptor } : descriptor;
  if (!error) return t("common.error");
  if (options.write && error.offline) return t("write.offline");
  const translationKey = error.code && API_ERROR_TRANSLATION_KEYS[error.code];
  if (translationKey) return t(translationKey, error.params);
  if (error.status !== undefined && error.status >= 500) return t("common.error");
  return error.message || t("common.error");
}

/**
 * Pick the most useful user-facing string out of a thrown value.
 *
 * Known API error codes are translated. Unknown backend codes retain their
 * human-readable message so domain validation remains useful. Server errors
 * and stray non-Error throws use the translated generic fallback.
 */
export function apiErrorMessage(error: unknown, t: TranslateFn): string {
  return apiErrorDescriptorMessage(apiErrorDescriptor(error), t);
}

export function apiWriteErrorMessage(error: unknown, t: TranslateFn): string {
  return apiErrorDescriptorMessage(apiErrorDescriptor(error), t, { write: true });
}
