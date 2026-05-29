"""Normalisation, validation and rendering for user-supplied payment
identifiers.

The user-facing input field accepts a free-form value (e.g. a paypal.me
link, a bare username with or without "@", or an email address).  This
module turns each of those into a single normalised pair
``(kind, identifier)`` that the model stores, and the inverse - the URL
the payer should be redirected to (or copy text + send-money fallback) -
when surfacing the method in the settle popup.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator

from splex.accounts.models import PaymentMethod

# PayPal allows alphanumeric + underscore + dash + dot in paypal.me handles.
# Length 1-20 is documented; we accept up to 30 to be lenient for future
# changes and reject the obvious junk.
_PAYPAL_HANDLE_RE = re.compile(r"^[A-Za-z0-9_\-.]{1,30}$")

# Where the PayPal app/web sends people when no recipient is encoded.  Used as
# the deep-link target when the user's identifier is an email - there's no
# documented URL scheme that pre-fills an email recipient.
_PAYPAL_SEND_MONEY_FALLBACK_URL = "https://www.paypal.com/myaccount/transfer/homepage/pay"


class PayPalParseError(ValueError):
    """Raised when a user-supplied value can't be turned into either a
    paypal.me handle or a valid email address."""


@dataclass(frozen=True)
class ParsedPaypal:
    kind: str  # PaymentMethod.Kind value
    identifier: str

    @property
    def is_handle(self) -> bool:
        return self.kind == PaymentMethod.Kind.PAYPAL_HANDLE


def parse_paypal_input(raw: str) -> ParsedPaypal:
    """Detect what kind of PayPal identifier the user typed.

    Accepts any of:
      * ``https://paypal.me/<handle>``  (with or without scheme/host)
      * ``paypal.me/<handle>``
      * ``@<handle>`` or ``<handle>``
      * ``user@example.com``

    Anything else raises :class:`PayPalParseError` with a short message that
    can be surfaced verbatim to the user.
    """
    if raw is None:
        raise PayPalParseError("Enter a paypal.me link, handle, or email address.")
    value = raw.strip()
    if not value:
        raise PayPalParseError("Enter a paypal.me link, handle, or email address.")

    # Email path first - the "@" check disambiguates it from "@handle".
    if "@" in value and not value.startswith("@"):
        return _parse_email(value)

    # paypal.me link forms.
    stripped = _strip_paypal_me_prefix(value)
    if stripped is not None:
        value = stripped

    # Leading "@" is harmless and PayPal itself uses it in some UI.
    if value.startswith("@"):
        value = value[1:]

    if not value:
        raise PayPalParseError("Enter a paypal.me handle after the link.")
    if not _PAYPAL_HANDLE_RE.match(value):
        raise PayPalParseError(
            "PayPal handles only allow letters, numbers, underscores, dashes "
            "and dots."
        )
    return ParsedPaypal(kind=PaymentMethod.Kind.PAYPAL_HANDLE, identifier=value)


def _parse_email(value: str) -> ParsedPaypal:
    canonical = value.strip().lower()
    try:
        EmailValidator()(canonical)
    except ValidationError as exc:
        raise PayPalParseError("That doesn't look like a valid email address.") from exc
    return ParsedPaypal(kind=PaymentMethod.Kind.PAYPAL_EMAIL, identifier=canonical)


def _strip_paypal_me_prefix(value: str) -> str | None:
    """Return the path portion of a paypal.me URL, or ``None`` if the value
    doesn't look like one."""
    lowered = value.lower()
    for prefix in (
        "https://paypal.me/",
        "http://paypal.me/",
        "paypal.me/",
        "https://www.paypal.com/paypalme/",
        "http://www.paypal.com/paypalme/",
        "www.paypal.com/paypalme/",
        "paypal.com/paypalme/",
    ):
        if lowered.startswith(prefix):
            rest = value[len(prefix):]
            # Drop any trailing path/query - paypal.me/<handle>/<amount> is
            # legal but we only store the handle.
            return rest.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    return None


# ---------------------------------------------------------------------------
# Outgoing rendering: what the payer's "Pay with PayPal" button should open.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RenderedPaypal:
    """Information the frontend needs to render a PayPal "Pay" button."""

    # Always present - the canonical handle or email so the UI can show it
    # alongside the button.
    display: str
    # Always present - a URL safe to open in a new tab.  For handles this is
    # the paypal.me deep link (pre-filled recipient and optional amount);
    # for emails this is the generic send-money page where the user pastes
    # the email manually.
    url: str
    # Whether the URL contains the recipient.  Drives the "copy" / "open"
    # secondary UI in the dialog.
    pre_fills_recipient: bool


def render_paypal(method: PaymentMethod, *, amount=None, currency=None
                   ) -> RenderedPaypal:
    if method.kind == PaymentMethod.Kind.PAYPAL_HANDLE:
        url = f"https://paypal.me/{method.identifier}"
        if amount is not None:
            # PayPal accepts "<amount>" or "<amount><currency>" in the path.
            suffix = f"{amount}"
            if currency:
                suffix = f"{suffix}{currency.upper()}"
            url = f"{url}/{suffix}"
        return RenderedPaypal(
            display=f"paypal.me/{method.identifier}",
            url=url,
            pre_fills_recipient=True,
        )
    return RenderedPaypal(
        display=method.identifier,
        url=_PAYPAL_SEND_MONEY_FALLBACK_URL,
        pre_fills_recipient=False,
    )
