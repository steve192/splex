"""Tests for the payment-methods backend.

Covers the PayPal input parser (every format the user could realistically
type), the service-layer "single preferred" invariant, the CRUD endpoints,
and the per-participant preferred-payment lookup that powers the
settle-up popup.
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.accounts.models import PaymentMethod
from splex.accounts.payment_services import (
    create_payment_method,
    delete_payment_method,
    set_preferred_payment_method,
)
from splex.accounts.payments import (
    PayPalParseError,
    parse_paypal_input,
    render_paypal,
)
from splex.friends.services import create_friendship
from splex.groups.services import (
    add_registered_participant,
    add_unregistered_participant,
    create_group,
)
from splex.participants.services import get_or_create_user_participant


def _user(email="me@example.com", name="Me"):
    return get_user_model().objects.create_user(email=email, display_name=name)


def _client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


# ---------------------------------------------------------------------------
# Pure parser: parse_paypal_input
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected_identifier",
    [
        ("alice123", "alice123"),
        ("@alice123", "alice123"),
        ("paypal.me/alice123", "alice123"),
        ("https://paypal.me/alice123", "alice123"),
        ("http://paypal.me/alice123", "alice123"),
        ("https://www.paypal.com/paypalme/alice123", "alice123"),
        ("paypal.com/paypalme/alice123", "alice123"),
        ("PAYPAL.ME/alice123", "alice123"),
        ("  alice123  ", "alice123"),
        # Trailing path/query/fragment should be stripped - paypal.me/<handle>/<amount>
        # is a thing but we only store the handle.
        ("paypal.me/alice123/25EUR", "alice123"),
        ("https://paypal.me/alice123?foo=bar", "alice123"),
        ("https://paypal.me/alice123#fragment", "alice123"),
    ],
)
def test_parse_paypal_input_recognises_handle_forms(raw, expected_identifier):
    parsed = parse_paypal_input(raw)
    assert parsed.is_handle
    assert parsed.identifier == expected_identifier


def test_parse_paypal_input_accepts_email_and_lowercases_it():
    parsed = parse_paypal_input("Alice@Example.COM")
    assert parsed.kind == PaymentMethod.Kind.PAYPAL_EMAIL
    assert parsed.identifier == "alice@example.com"


@pytest.mark.parametrize("raw", ["", "   ", None])
def test_parse_paypal_input_rejects_blank(raw):
    with pytest.raises(PayPalParseError):
        parse_paypal_input(raw)


@pytest.mark.parametrize(
    "raw", ["alice space", "alice/bob", "@", "https://paypal.me/"],
)
def test_parse_paypal_input_rejects_invalid_handle(raw):
    with pytest.raises(PayPalParseError):
        parse_paypal_input(raw)


def test_parse_paypal_input_rejects_invalid_email():
    with pytest.raises(PayPalParseError):
        parse_paypal_input("not-an@email")


# ---------------------------------------------------------------------------
# render_paypal: outgoing URL building
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_render_handle_includes_amount_and_currency_in_url():
    user = _user()
    method = PaymentMethod.objects.create(
        user=user, kind=PaymentMethod.Kind.PAYPAL_HANDLE, identifier="alice",
    )
    rendered = render_paypal(method, amount="12.50", currency="eur")
    assert rendered.url == "https://paypal.me/alice/12.50EUR"
    assert rendered.pre_fills_recipient is True
    assert rendered.display == "paypal.me/alice"


@pytest.mark.django_db
def test_render_handle_works_without_amount():
    user = _user()
    method = PaymentMethod.objects.create(
        user=user, kind=PaymentMethod.Kind.PAYPAL_HANDLE, identifier="alice",
    )
    rendered = render_paypal(method)
    assert rendered.url == "https://paypal.me/alice"


@pytest.mark.django_db
def test_render_email_falls_back_to_generic_paypal_url():
    user = _user()
    method = PaymentMethod.objects.create(
        user=user, kind=PaymentMethod.Kind.PAYPAL_EMAIL, identifier="alice@example.com",
    )
    rendered = render_paypal(method, amount="12.50", currency="EUR")
    # No documented PayPal URL pre-fills an email recipient - the rendered URL
    # is the generic send-money page and the email is exposed via ``display``
    # for the UI to show in copyable form.
    assert "paypal.com" in rendered.url
    assert rendered.display == "alice@example.com"
    assert rendered.pre_fills_recipient is False


# ---------------------------------------------------------------------------
# Service-layer: create / set preferred / delete invariants
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_create_payment_method_marks_first_method_preferred_implicitly():
    """The very first method a user adds always becomes preferred, even
    without ``make_preferred=True`` - otherwise the settle popup would have
    nothing to suggest."""
    user = _user()
    method = create_payment_method(
        user=user, parsed=parse_paypal_input("alice"),
    )
    method.refresh_from_db()
    assert method.is_preferred is True


@pytest.mark.django_db
def test_create_payment_method_keeps_existing_preferred_for_extra_methods():
    user = _user()
    first = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    second = create_payment_method(user=user, parsed=parse_paypal_input("alice@example.com"))
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.is_preferred is True
    assert second.is_preferred is False


@pytest.mark.django_db
def test_create_payment_method_make_preferred_demotes_existing():
    user = _user()
    first = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    second = create_payment_method(
        user=user, parsed=parse_paypal_input("alice@example.com"), make_preferred=True,
    )
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.is_preferred is False
    assert second.is_preferred is True


@pytest.mark.django_db
def test_create_payment_method_is_idempotent_for_same_identifier():
    user = _user()
    first = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    again = create_payment_method(user=user, parsed=parse_paypal_input("@alice"))
    assert first.id == again.id


@pytest.mark.django_db
def test_set_preferred_payment_method_only_one_preferred_at_a_time():
    """Property: after any sequence of set_preferred() calls there is at
    most one method with ``is_preferred=True``."""
    user = _user()
    a = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    b = create_payment_method(user=user, parsed=parse_paypal_input("alice@example.com"))
    c = create_payment_method(user=user, parsed=parse_paypal_input("bob"))

    for method in (a, b, c, a, c, b):
        set_preferred_payment_method(user=user, method=method)
        assert (
            user.payment_methods.filter(is_preferred=True).count() == 1
        ), "single-preferred invariant broken"


@pytest.mark.django_db
def test_set_preferred_payment_method_rejects_other_users_method():
    owner = _user("a@example.com")
    intruder = _user("b@example.com")
    method = create_payment_method(user=owner, parsed=parse_paypal_input("alice"))
    with pytest.raises(PermissionError):
        set_preferred_payment_method(user=intruder, method=method)


@pytest.mark.django_db
def test_delete_payment_method_promotes_oldest_remaining_to_preferred():
    """Deleting the preferred method shouldn't leave the user with zero
    preferred entries while other methods still exist - the settle popup
    relies on there always being one to suggest."""
    user = _user()
    a = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    b = create_payment_method(user=user, parsed=parse_paypal_input("bob"))
    c = create_payment_method(user=user, parsed=parse_paypal_input("carol"))
    # ``a`` is the oldest and currently preferred; delete it.
    delete_payment_method(user=user, method=a)
    b.refresh_from_db()
    c.refresh_from_db()
    assert b.is_preferred is True
    assert c.is_preferred is False


@pytest.mark.django_db
def test_delete_non_preferred_method_does_not_promote_anyone():
    user = _user()
    a = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    b = create_payment_method(user=user, parsed=parse_paypal_input("bob"))
    delete_payment_method(user=user, method=b)
    a.refresh_from_db()
    assert a.is_preferred is True


@pytest.mark.django_db
def test_delete_payment_method_rejects_other_users_method():
    owner = _user("a@example.com")
    intruder = _user("b@example.com")
    method = create_payment_method(user=owner, parsed=parse_paypal_input("alice"))
    with pytest.raises(PermissionError):
        delete_payment_method(user=intruder, method=method)


# ---------------------------------------------------------------------------
# CRUD API: /api/me/payment-methods/
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_post_payment_methods_creates_and_returns_serialized_row():
    user = _user()
    response = _client(user).post(
        "/api/me/payment-methods/", {"paypal": "https://paypal.me/alice"}, format="json",
    )
    assert response.status_code == 201
    body = response.data
    assert body["kind"] == PaymentMethod.Kind.PAYPAL_HANDLE
    assert body["identifier"] == "alice"
    assert body["is_preferred"] is True  # implicit first-method preference
    assert body["url"] == "https://paypal.me/alice"
    assert body["pre_fills_recipient"] is True


@pytest.mark.django_db
def test_post_payment_methods_returns_400_on_invalid_input():
    user = _user()
    response = _client(user).post(
        "/api/me/payment-methods/", {"paypal": "not an @ valid handle"}, format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_get_payment_methods_lists_only_callers_methods():
    owner = _user("a@example.com")
    other = _user("b@example.com")
    create_payment_method(user=owner, parsed=parse_paypal_input("owner-handle"))
    create_payment_method(user=other, parsed=parse_paypal_input("other-handle"))

    response = _client(owner).get("/api/me/payment-methods/")
    assert response.status_code == 200
    assert [row["identifier"] for row in response.data] == ["owner-handle"]


@pytest.mark.django_db
def test_patch_payment_method_promotes_to_preferred_and_demotes_others():
    user = _user()
    first = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    second = create_payment_method(user=user, parsed=parse_paypal_input("bob"))

    response = _client(user).patch(
        f"/api/me/payment-methods/{second.id}/", {"is_preferred": True}, format="json",
    )
    assert response.status_code == 200
    assert response.data["is_preferred"] is True
    first.refresh_from_db()
    assert first.is_preferred is False


@pytest.mark.django_db
def test_patch_payment_method_rejects_other_users_row():
    owner = _user("a@example.com")
    intruder = _user("b@example.com")
    method = create_payment_method(user=owner, parsed=parse_paypal_input("alice"))
    response = _client(intruder).patch(
        f"/api/me/payment-methods/{method.id}/", {"is_preferred": True}, format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_payment_method_endpoint_returns_204_and_removes_row():
    user = _user()
    method = create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    response = _client(user).delete(f"/api/me/payment-methods/{method.id}/")
    assert response.status_code == 204
    assert not PaymentMethod.objects.filter(id=method.id).exists()


# ---------------------------------------------------------------------------
# Per-participant preferred-payment lookup for the settle popup
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_preferred_payment_endpoint_returns_method_for_group_member():
    actor = _user("a@example.com")
    receiver = _user("b@example.com")
    create_payment_method(user=receiver, parsed=parse_paypal_input("receiver"))
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    receiver_participant = get_or_create_user_participant(receiver)
    create_friendship(actor, receiver_participant)
    add_registered_participant(actor=actor, group=group, participant=receiver_participant)

    response = _client(actor).get(
        f"/api/participants/{receiver_participant.id}/preferred-payment-method/",
    )
    assert response.status_code == 200
    assert response.data["identifier"] == "receiver"


@pytest.mark.django_db
def test_preferred_payment_endpoint_returns_method_for_friend():
    actor = _user("a@example.com")
    receiver = _user("b@example.com")
    create_payment_method(user=receiver, parsed=parse_paypal_input("receiver"))
    receiver_participant = get_or_create_user_participant(receiver)
    create_friendship(actor, receiver_participant)

    response = _client(actor).get(
        f"/api/participants/{receiver_participant.id}/preferred-payment-method/",
    )
    assert response.status_code == 200
    assert response.data["identifier"] == "receiver"


@pytest.mark.django_db
def test_preferred_payment_endpoint_returns_204_for_unrelated_participant():
    """A participant the caller has no group or friendship with must not
    leak their PayPal handle through this endpoint."""
    actor = _user("a@example.com")
    stranger = _user("b@example.com")
    create_payment_method(user=stranger, parsed=parse_paypal_input("stranger"))
    stranger_participant = get_or_create_user_participant(stranger)
    response = _client(actor).get(
        f"/api/participants/{stranger_participant.id}/preferred-payment-method/",
    )
    assert response.status_code == 204


@pytest.mark.django_db
def test_preferred_payment_endpoint_returns_204_for_unregistered_placeholder():
    actor = _user("a@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(
        actor=actor, group=group, display_name="Ghost",
    )
    response = _client(actor).get(
        f"/api/participants/{placeholder.id}/preferred-payment-method/",
    )
    assert response.status_code == 204


@pytest.mark.django_db
def test_preferred_payment_endpoint_returns_204_when_user_has_no_method():
    actor = _user("a@example.com")
    receiver = _user("b@example.com")
    receiver_participant = get_or_create_user_participant(receiver)
    create_friendship(actor, receiver_participant)
    response = _client(actor).get(
        f"/api/participants/{receiver_participant.id}/preferred-payment-method/",
    )
    assert response.status_code == 204


@pytest.mark.django_db
def test_preferred_payment_endpoint_allows_self_lookup():
    """Self-lookup is fine even if you don't share a group with yourself -
    handy for the frontend to render its own settings preview."""
    user = _user()
    create_payment_method(user=user, parsed=parse_paypal_input("alice"))
    me_participant = get_or_create_user_participant(user)
    response = _client(user).get(
        f"/api/participants/{me_participant.id}/preferred-payment-method/",
    )
    assert response.status_code == 200
    assert response.data["identifier"] == "alice"
