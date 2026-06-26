from dataclasses import dataclass, field
from enum import StrEnum
from http import HTTPStatus
from typing import Any

type ErrorParam = str | int | float


@dataclass(frozen=True)
class NormalizedApiError:
    """Transport-neutral representation of one public API failure.

    Exceptions and framework adapters create this value; the API boundary is
    responsible for turning it into an HTTP response. ``fields`` intentionally
    accepts the framework's validation shape, which can be nested.
    """

    code: str
    message: str | None = None
    params: dict[str, ErrorParam] = field(default_factory=dict)
    fields: Any | None = None

    def to_data(self) -> dict:
        """Return the canonical JSON-ready error envelope."""
        error = {"code": self.code}
        if self.message is not None:
            error["message"] = self.message
        if self.params:
            error["params"] = self.params

        data = {"error": error}
        if self.fields is not None:
            data["fields"] = self.fields
        return data


class ErrorCode(StrEnum):
    """Stable, product-level error identifiers raised by Splex domain code.

    These codes deliberately live outside the DRF API module so services can
    express a business-rule failure without depending on HTTP or DRF. The API
    exception handler serializes them into the shared error envelope.
    """

    AUTH_EMAIL_SEND_FAILED = "auth_email_send_failed"
    AUTH_GOOGLE_FAILED = "auth_google_failed"
    AUTH_LOGIN_CODE_INVALID = "auth_login_code_invalid"
    AUTH_LOGIN_TOKEN_INVALID = "auth_login_token_invalid"
    AUTH_REGISTRATION_DISABLED = "auth_registration_disabled"
    CURRENCY_RATE_UNAVAILABLE = "currency_rate_unavailable"
    EXPENSE_ACCESS_DENIED = "expense_access_denied"
    EXPENSE_ADJUSTMENT_NEGATIVE = "expense_adjustment_negative"
    EXPENSE_CONTEXT_REQUIRED = "expense_context_required"
    EXPENSE_FRIEND_MOVE_FORBIDDEN = "expense_friend_move_forbidden"
    EXPENSE_MOVE_GROUP_ONLY = "expense_move_group_only"
    EXPENSE_PERCENTAGE_INVALID = "expense_percentage_invalid"
    EXPENSE_SHARES_INVALID = "expense_shares_invalid"
    EXPENSE_SPLIT_UNSUPPORTED = "expense_split_unsupported"
    EXPENSE_TARGET_GROUP_INVALID = "expense_target_group_invalid"
    EXPENSE_TARGET_PARTICIPANTS_MISSING = "expense_target_participants_missing"
    FRIEND_NOT_SETTLED = "friend_not_settled"
    FRIEND_SELF = "friend_self"
    GROUP_ALREADY_MEMBER = "group_already_member"
    GROUP_CURRENCY_LOCKED = "group_currency_locked"
    GROUP_DELETED = "group_deleted"
    GROUP_EXISTING_FRIEND_REQUIRED = "group_existing_friend_required"
    GROUP_MEMBER_REQUIRED = "group_member_required"
    GROUP_NOT_SETTLED = "group_not_settled"
    GROUP_PARTICIPANT_ALREADY_MEMBER = "group_participant_already_member"
    GROUP_PARTICIPANT_INACTIVE = "group_participant_inactive"
    GROUP_PARTICIPANT_NOT_MEMBER = "group_participant_not_member"
    GROUP_REMOVE_SELF = "group_remove_self"
    GROUP_RENAME_REGISTERED = "group_rename_registered"
    IMAGE_INVALID = "image_invalid"
    IMAGE_TOO_LARGE = "image_too_large"
    IMAGE_TYPE_UNSUPPORTED = "image_type_unsupported"
    IMPORTS_DISABLED = "imports_disabled"
    INVITATION_INVALID = "invitation_invalid"
    LOCATION_COORDINATES_INVALID = "location_coordinates_invalid"
    PAYMENT_METHOD_INVALID = "payment_method_invalid"
    RECEIPT_CONTEXT_REQUIRED = "receipt_context_required"
    RECEIPT_DELETE_FORBIDDEN = "receipt_delete_forbidden"
    RECEIPT_EMPTY = "receipt_empty"
    RECEIPT_FILE_REQUIRED = "receipt_file_required"
    RECEIPT_QUOTA_EXCEEDED = "receipt_quota_exceeded"
    RECEIPT_TOO_LARGE = "receipt_too_large"
    RECEIPT_TYPE_INVALID = "receipt_type_invalid"
    REMINDER_SELF = "reminder_self"
    REMINDER_TARGET_NOT_IN_DEBT = "reminder_target_not_in_debt"
    REMINDER_TARGET_UNREGISTERED = "reminder_target_unregistered"
    SETTLEMENT_DELETED = "settlement_deleted"
    SETTLEMENT_PARTICIPANT_INVALID = "settlement_participant_invalid"
    SETTLEMENT_PARTICIPANTS_EQUAL = "settlement_participants_equal"
    SPLIT_PRO_AUTH_FAILED = "split_pro_auth_failed"
    SPLIT_PRO_CONNECTION_FAILED = "split_pro_connection_failed"
    SPLIT_PRO_SCHEMA_INVALID = "split_pro_schema_invalid"
    SPLIT_PRO_USER_NOT_FOUND = "split_pro_user_not_found"
    SPLITWISE_AUTH_FAILED = "splitwise_auth_failed"
    SPLITWISE_FAILED = "splitwise_failed"
    SYNC_MUTATION_INVALID = "sync_mutation_invalid"
    SYNC_MUTATION_UNSUPPORTED = "sync_mutation_unsupported"


class ApiResponseError(Exception):
    """Base exception for expected failures exposed through the JSON API.

    It owns the stable error data but deliberately does not create a DRF
    ``Response``. That keeps domain code independent from the HTTP framework;
    the global exception handler serializes :meth:`to_normalized_error`.
    """

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        status: int = HTTPStatus.BAD_REQUEST,
        params: dict[str, ErrorParam] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.status = int(status)
        self.params = params or {}

    def to_normalized_error(self) -> NormalizedApiError:
        """Build the public error data without coupling to DRF."""
        return NormalizedApiError(
            code=str(self.code),
            message=str(self),
            params=self.params,
        )


class DomainError(ApiResponseError, ValueError):
    """A user-actionable domain failure with a stable code and HTTP status.

    Subclassing ``ValueError`` preserves existing service contracts, but API
    boundaries must let this exception reach the global exception handler
    rather than converting it to an ad-hoc ``Response``.
    """


class DomainPermissionError(ApiResponseError, PermissionError):
    """The permission-specific counterpart of ``DomainError`` (always 403)."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        params: dict[str, ErrorParam] | None = None,
    ):
        super().__init__(code, message, status=HTTPStatus.FORBIDDEN, params=params)
