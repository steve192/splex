"""Service-layer write helpers for :class:`PaymentMethod`.

Kept separate from ``accounts/services.py`` (which is auth-heavy) and from
``payments.py`` (pure parsing/rendering) so callers can import a thin,
mutation-only surface.
"""

from __future__ import annotations

from django.db import transaction

from splex.accounts.models import PaymentMethod
from splex.accounts.payments import ParsedPaypal


@transaction.atomic
def create_payment_method(
    *, user, parsed: ParsedPaypal, make_preferred: bool = False,
) -> PaymentMethod:
    """Create or look up a payment method for ``user``.

    Idempotent against the ``(user, kind, identifier)`` unique constraint:
    re-adding the same identifier returns the existing row instead of
    raising.  When ``make_preferred`` is true (or the user has no preferred
    method yet) the new row becomes the single preferred entry.
    """
    method, created = PaymentMethod.objects.get_or_create(
        user=user, kind=parsed.kind, identifier=parsed.identifier,
    )
    needs_preferred = make_preferred or not user.payment_methods.filter(
        is_preferred=True,
    ).exclude(id=method.id).exists()
    if needs_preferred:
        set_preferred_payment_method(user=user, method=method)
    elif not created:
        # Touch updated_at so the UI can show "last edited" if it wants.
        method.save(update_fields=["updated_at"])
    return method


@transaction.atomic
def set_preferred_payment_method(*, user, method: PaymentMethod) -> PaymentMethod:
    """Mark ``method`` as the user's single preferred payment method.

    Atomically clears the ``is_preferred`` flag on every other method
    belonging to ``user`` and sets it on ``method``.  Callers should already
    have verified that ``method.user_id == user.id``; we re-check here as a
    safety net.
    """
    if method.user_id != user.id:
        raise PermissionError("Payment method does not belong to this user.")
    PaymentMethod.objects.filter(user=user).exclude(id=method.id).update(
        is_preferred=False,
    )
    # Always write to the target row.  Relying on the in-memory
    # ``method.is_preferred`` here would be unsound: ``method`` may have been
    # loaded earlier and another code path (or even this same function for
    # a different method) could have flipped the flag underneath us.  The
    # cost is one extra row write per call.
    method.is_preferred = True
    method.save(update_fields=["is_preferred", "updated_at"])
    return method


@transaction.atomic
def delete_payment_method(*, user, method: PaymentMethod) -> None:
    """Delete ``method`` and, if it was the preferred one, promote the
    oldest remaining method to preferred so the settle popup keeps having
    something to suggest."""
    if method.user_id != user.id:
        raise PermissionError("Payment method does not belong to this user.")
    was_preferred = method.is_preferred
    method.delete()
    if not was_preferred:
        return
    fallback = (
        PaymentMethod.objects.filter(user=user).order_by("created_at").first()
    )
    if fallback is not None:
        set_preferred_payment_method(user=user, method=fallback)


def preferred_payment_method_for(user) -> PaymentMethod | None:
    return (
        PaymentMethod.objects.filter(user=user, is_preferred=True)
        .order_by("created_at").first()
    )
