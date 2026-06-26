import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

import { ApiError } from "../api/client";
import { apiErrorMessage, apiWriteErrorMessage } from "./apiErrors";

const fallback = "fallback-text";
const writeOffline = "write-offline-text";
const t = (key: string) => {
  if (key === "common.error") return fallback;
  if (key === "write.offline") return writeOffline;
  return key;
};

describe("apiErrorMessage", () => {
  it("returns the Error message when one is set", () => {
    expect(apiErrorMessage(new Error("backend rejected"), t)).toBe(
      "backend rejected",
    );
  });

  it("falls back to the translated generic message for an Error with no message", () => {
    expect(apiErrorMessage(new Error(""), t)).toBe(fallback);
  });

  it("falls back for non-Error throws (strings, undefined, plain objects)", () => {
    expect(apiErrorMessage("oops", t)).toBe(fallback);
    expect(apiErrorMessage(undefined, t)).toBe(fallback);
    expect(apiErrorMessage({ status: 500 }, t)).toBe(fallback);
  });

  it("translates known backend error codes with their parameters", () => {
    const translate = (key: string, params?: Record<string, string | number>) =>
      key === "apiError.throttled" ? `wait-${params?.wait_seconds}` : key;
    const error = new ApiError("Request was throttled.", {
      status: 429,
      code: "throttled",
      params: { wait_seconds: 17 }
    });

    expect(apiErrorMessage(error, translate)).toBe("wait-17");
  });

  it("translates invitation and import errors without screen-specific parsing", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      apiErrorMessage(new ApiError("Invitation not found.", { code: "invitation_invalid" }), translate)
    ).toBe("translated:invite.invalid");
    expect(
      apiErrorMessage(new ApiError("Splitwise rejected the API key.", { code: "splitwise_auth_failed" }), translate)
    ).toBe("translated:splitwiseImport.invalidKey");
  });

  it("routes domain codes through specific feature translations", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      apiErrorMessage(new ApiError("Settle first.", { code: "group_not_settled" }), translate)
    ).toBe("translated:group.deleteBlocked");
    expect(
      apiErrorMessage(new ApiError("Bad split.", { code: "expense_shares_invalid" }), translate)
    ).toBe("translated:expense.sharesInvalid");
    expect(
      apiErrorMessage(new ApiError("Registration disabled.", { code: "auth_registration_disabled" }), translate)
    ).toBe("translated:auth.registrationDisabled");
    expect(
      apiErrorMessage(new ApiError("Upload rejected.", { code: "receipt_type_invalid" }), translate)
    ).toBe("translated:receipts.typeInvalid");
    expect(
      apiErrorMessage(new ApiError("Cannot remind yourself.", { code: "reminder_self" }), translate)
    ).toBe("translated:settlement.reminderSelf");
  });

  it.each([
    ["currency_rate_unavailable", "apiError.currencyRateUnavailable"],
    ["expense_access_denied", "expense.accessDenied"],
    ["expense_context_required", "expense.contextRequired"],
    ["expense_friend_move_forbidden", "expense.friendMoveForbidden"],
    ["expense_move_group_only", "expense.moveGroupOnly"],
    ["expense_percentage_invalid", "expense.percentagesInvalid"],
    ["expense_shares_invalid", "expense.sharesInvalid"],
    ["expense_split_unsupported", "expense.splitUnsupported"],
    ["expense_target_group_invalid", "expense.targetGroupInvalid"],
    ["friend_self", "friend.self"],
    ["group_already_member", "group.alreadyMember"],
    ["group_currency_locked", "group.currencyLocked"],
    ["group_deleted", "group.deletedReadOnly"],
    ["group_existing_friend_required", "group.existingFriendRequired"],
    ["group_member_required", "group.memberRequired"],
    ["group_participant_already_member", "group.participantAlreadyMember"],
    ["group_participant_inactive", "group.participantInactive"],
    ["group_participant_not_member", "group.participantNotMember"],
    ["group_remove_self", "group.removeSelf"],
    ["group_rename_registered", "group.renameRegistered"],
    ["image_invalid", "image.invalid"],
    ["image_too_large", "image.tooLarge"],
    ["image_type_unsupported", "image.typeUnsupported"],
    ["imports_disabled", "importFromService.disabledByServer"],
    ["location_coordinates_invalid", "location.coordinatesInvalid"],
    ["payment_method_invalid", "paymentMethods.invalid"],
    ["receipt_context_required", "receipts.contextRequired"],
    ["receipt_delete_forbidden", "receipts.deleteForbidden"],
    ["receipt_empty", "receipts.emptyFile"],
    ["receipt_file_required", "receipts.fileRequired"],
    ["receipt_quota_exceeded", "receipts.quotaExceeded"],
    ["receipt_too_large", "receipts.tooLarge"],
    ["receipt_type_invalid", "receipts.typeInvalid"],
    ["settlement_deleted", "settlement.deletedReadOnly"],
    ["settlement_participant_invalid", "settlement.participantInvalid"],
    ["settlement_participants_equal", "settlement.participantsEqual"],
    ["split_pro_schema_invalid", "splitProImport.schemaInvalid"],
    ["split_pro_user_not_found", "splitProImport.userNotFound"],
    ["splitwise_failed", "splitwiseImport.failed"],
    ["sync_mutation_invalid", "sync.mutationInvalid"],
    ["sync_mutation_unsupported", "sync.mutationUnsupported"]
  ])("uses a dedicated message for %s", (code, key) => {
    const translate = (translationKey: string) => `translated:${translationKey}`;

    expect(apiErrorMessage(new ApiError("Backend detail.", { code }), translate)).toBe(
      `translated:${key}`
    );
  });

  it("uses a clean backend message for unknown domain codes", () => {
    const error = new ApiError("Settle up before deleting this group.", {
      status: 400,
      code: "group_has_balance"
    });

    expect(apiErrorMessage(error, t)).toBe("Settle up before deleting this group.");
  });
});

describe("apiWriteErrorMessage", () => {
  it("uses a translated bad-connection message for offline write failures", () => {
    const error = new ApiError("Network unavailable", { offline: true });
    expect(apiWriteErrorMessage(error, t)).toBe(writeOffline);
  });

  it("preserves backend write validation messages when the request reached the server", () => {
    expect(apiWriteErrorMessage(new Error("Name is required"), t)).toBe(
      "Name is required",
    );
  });
});
