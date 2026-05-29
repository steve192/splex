"""Tests for the "minimize transactions" debt simplification.

These tests cover the pure ``simplified_debts`` reducer and the integration
through ``group_member_balance_rows``.  The simplification only rearranges
the edges between participants - per-participant totals must stay
identical between modes, no money is created or lost, and the result must
be deterministic so the frontend doesn't see edges flicker between
requests.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.balances.selectors import (
    group_debts,
    group_member_balance_rows,
    simplified_debts,
)
from splex.expenses.services import create_expense
from splex.groups.services import add_unregistered_participant, create_group
from splex.participants.services import get_or_create_user_participant
from splex.settlements.services import create_settlement

# ---------------------------------------------------------------------------
# Pure ``simplified_debts`` reducer
# ---------------------------------------------------------------------------


def test_simplified_debts_collapses_three_person_cycle():
    """The canonical example: A→B 5, B→C 10, C→A 5 reduces to B→C 5."""
    debts = {
        (1, 2): Decimal("5.00"),   # A owes B
        (2, 3): Decimal("10.00"),  # B owes C
        (3, 1): Decimal("5.00"),   # C owes A
    }
    assert simplified_debts(debts) == {(2, 3): Decimal("5.00")}


def test_simplified_debts_returns_empty_when_settled():
    """An empty graph in, an empty graph out - no spurious transactions."""
    assert simplified_debts({}) == {}


def test_simplified_debts_passes_through_two_person_debt():
    """The simplest case must round-trip unchanged."""
    debts = {(1, 2): Decimal("12.50")}
    assert simplified_debts(debts) == {(1, 2): Decimal("12.50")}


def test_simplified_debts_handles_two_creditors_one_debtor():
    """One debtor splits across two creditors in the order of largest first."""
    # A (1) owes 30 total. B (2) is owed 20, C (3) is owed 10.
    debts = {
        (1, 2): Decimal("20.00"),
        (1, 3): Decimal("10.00"),
    }
    result = simplified_debts(debts)
    # Total flow in = total flow out.
    assert sum(result.values()) == Decimal("30.00")
    # Both creditors get exactly what they're owed.
    by_creditor: dict[int, Decimal] = {}
    for (_, creditor_id), amount in result.items():
        by_creditor[creditor_id] = by_creditor.get(creditor_id, Decimal("0")) + amount
    assert by_creditor == {2: Decimal("20.00"), 3: Decimal("10.00")}


def test_simplified_debts_chain_collapses_to_endpoints():
    """A→B 10, B→C 10 reduces to A→C 10 (B drops out entirely)."""
    debts = {
        (1, 2): Decimal("10.00"),
        (2, 3): Decimal("10.00"),
    }
    assert simplified_debts(debts) == {(1, 3): Decimal("10.00")}


def test_simplified_debts_preserves_per_participant_net():
    """Property: each participant's net (incoming - outgoing) is unchanged
    by simplification.  This is the invariant that makes it safe to swap
    one representation for the other in the UI."""
    debts = {
        (1, 2): Decimal("7.50"),
        (2, 3): Decimal("4.20"),
        (3, 1): Decimal("3.10"),
        (1, 4): Decimal("2.00"),
        (4, 2): Decimal("1.00"),
    }

    def nets(graph):
        result: dict[int, Decimal] = {}
        for (debtor, creditor), amount in graph.items():
            result[debtor] = result.get(debtor, Decimal("0")) - amount
            result[creditor] = result.get(creditor, Decimal("0")) + amount
        return result

    raw_nets = nets(debts)
    simplified = simplified_debts(debts)
    simplified_nets = nets(simplified)
    # Every participant present in either graph must have the same net in both.
    all_ids = set(raw_nets) | set(simplified_nets)
    for pid in all_ids:
        assert raw_nets.get(pid, Decimal("0")) == simplified_nets.get(pid, Decimal("0"))


def test_simplified_debts_never_increases_edge_count():
    """Property: simplification never adds edges - in the worst case it is
    a no-op, in the best case it's strictly fewer.
    """
    debts = {
        (1, 2): Decimal("5.00"),
        (2, 3): Decimal("5.00"),
        (3, 4): Decimal("5.00"),
        (4, 1): Decimal("5.00"),
    }
    assert len(simplified_debts(debts)) <= len(debts)


def test_simplified_debts_handles_rounding_residue_below_a_cent():
    """Sub-cent residue from the netting pass must not produce ghost edges."""
    debts = {
        (1, 2): Decimal("10.001"),
        (1, 3): Decimal("9.999"),
    }
    result = simplified_debts(debts)
    # Total stays at 20.00 within rounding tolerance.
    assert sum(result.values()) == Decimal("20.00")
    # No edge below one cent slipped through.
    assert all(amount >= Decimal("0.01") for amount in result.values())


def test_simplified_debts_is_deterministic():
    """Re-running on the same input must produce byte-identical edges."""
    debts = {
        (10, 20): Decimal("3.00"),
        (20, 30): Decimal("4.00"),
        (30, 10): Decimal("2.00"),
        (40, 20): Decimal("1.00"),
    }
    first = list(simplified_debts(debts).items())
    second = list(simplified_debts(debts).items())
    assert first == second


# ---------------------------------------------------------------------------
# Integration through ``group_member_balance_rows``
# ---------------------------------------------------------------------------


def _make_group_with_three_members():
    User = get_user_model()
    actor = User.objects.create_user(email="a@example.com", display_name="A")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    b = add_unregistered_participant(actor=actor, group=group, display_name="B")
    c = add_unregistered_participant(actor=actor, group=group, display_name="C")
    a = get_or_create_user_participant(actor)
    return actor, group, a, b, c


def _expense(actor, group, *, payer, owers, total):
    """Helper: create an EXACT-split expense where ``payer`` paid ``total`` and
    ``owers`` is ``[(participant_id, amount), ...]`` summing to ``total``."""
    return create_expense(
        actor=actor, group=group,
        data={
            "description": "x",
            "amount": str(total),
            "currency": "EUR",
            "payments": [{"participant_id": payer.id, "amount": str(total)}],
            "split_method": "exact",
            "split_payload": {
                "shares": [
                    {"participant_id": pid, "amount": str(amount)}
                    for pid, amount in owers
                ],
            },
        },
    )


@pytest.mark.django_db
def test_group_balance_rows_simplified_reduces_cycle():
    """Three-person cycle: simplified mode produces fewer ``details`` rows
    than the raw mode but totals per member stay the same."""
    actor, group, a, b, c = _make_group_with_three_members()
    # Construct A owes B 5, B owes C 10, C owes A 5:
    # B pays 10 split equally (5 each) for the A-B pair → A owes B 5.
    _expense(actor, group, payer=b, owers=[(a.id, Decimal("5.00")), (b.id, Decimal("5.00"))],
             total=Decimal("10.00"))
    # C pays 20 split equally (10 each) for the B-C pair → B owes C 10.
    _expense(actor, group, payer=c, owers=[(b.id, Decimal("10.00")), (c.id, Decimal("10.00"))],
             total=Decimal("20.00"))
    # A pays 10 split equally (5 each) for the A-C pair → C owes A 5.
    _expense(actor, group, payer=a, owers=[(a.id, Decimal("5.00")), (c.id, Decimal("5.00"))],
             total=Decimal("10.00"))

    raw_rows = group_member_balance_rows(group)
    simplified_rows = group_member_balance_rows(group, simplified=True)

    # Per-member net totals must match exactly.
    raw_totals = {row["participant_id"]: row["amount"] for row in raw_rows}
    simp_totals = {row["participant_id"]: row["amount"] for row in simplified_rows}
    assert raw_totals == simp_totals

    # Raw mode shows 3 edges (one per cycle hop); simplified collapses to 1.
    def unique_edges(rows):
        edges = set()
        for row in rows:
            for detail in row["details"]:
                edges.add((detail["from_participant_id"], detail["to_participant_id"]))
        return edges

    assert len(unique_edges(raw_rows)) == 3
    simplified_edges = unique_edges(simplified_rows)
    assert simplified_edges == {(b.id, c.id)}


@pytest.mark.django_db
def test_group_balance_rows_simplified_settled_after_settlement():
    """A settlement still zeros out the balance in simplified mode."""
    actor, group, a, b, c = _make_group_with_three_members()
    # B pays 30 split equally → A and C each owe B 10.
    _expense(
        actor, group, payer=b,
        owers=[(a.id, Decimal("10.00")), (b.id, Decimal("10.00")), (c.id, Decimal("10.00"))],
        total=Decimal("30.00"),
    )
    # A pays back 10 to B.
    create_settlement(
        actor=actor, group=group,
        data={
            "payer_participant_id": a.id, "receiver_participant_id": b.id,
            "amount": "10.00", "currency": "EUR",
        },
    )

    simplified_rows = group_member_balance_rows(group, simplified=True)
    # Only the C → B edge should remain.
    edges = set()
    for row in simplified_rows:
        for detail in row["details"]:
            edges.add(
                (detail["from_participant_id"], detail["to_participant_id"], detail["amount"]),
            )
    assert edges == {(c.id, b.id, "10.00")}


@pytest.mark.django_db
def test_group_balance_rows_match_underlying_debts_when_not_simplified():
    """Sanity check: simplified=False is the unchanged historical behaviour."""
    actor, group, a, b, c = _make_group_with_three_members()
    _expense(
        actor, group, payer=b,
        owers=[(a.id, Decimal("10.00")), (b.id, Decimal("10.00"))],
        total=Decimal("20.00"),
    )
    rows = group_member_balance_rows(group)
    raw = group_debts(group)
    edges = {
        (detail["from_participant_id"], detail["to_participant_id"]): detail["amount"]
        for row in rows for detail in row["details"]
    }
    for pair, amount in raw.items():
        assert edges[pair] == str(amount)


@pytest.mark.django_db
def test_group_balance_rows_simplified_empty_when_no_expenses():
    """Empty group → empty details on both sides."""
    actor, group, *_ = _make_group_with_three_members()
    rows = group_member_balance_rows(group, simplified=True)
    assert all(row["details"] == [] for row in rows)
    assert all(row["amount"] == "0.00" for row in rows)


# ---------------------------------------------------------------------------
# API: ``GET /api/groups/<id>/balances/?simplified=true``
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_balances_endpoint_accepts_simplified_query_param():
    actor, group, a, b, c = _make_group_with_three_members()
    _expense(actor, group, payer=b, owers=[(a.id, Decimal("5.00")), (b.id, Decimal("5.00"))],
             total=Decimal("10.00"))
    _expense(actor, group, payer=c, owers=[(b.id, Decimal("10.00")), (c.id, Decimal("10.00"))],
             total=Decimal("20.00"))
    _expense(actor, group, payer=a, owers=[(a.id, Decimal("5.00")), (c.id, Decimal("5.00"))],
             total=Decimal("10.00"))

    client = APIClient()
    client.force_authenticate(user=actor)

    raw = client.get(f"/api/groups/{group.id}/balances/").json()
    simplified = client.get(f"/api/groups/{group.id}/balances/?simplified=true").json()

    def edges(payload):
        return {
            (detail["from_participant_id"], detail["to_participant_id"])
            for row in payload for detail in row["details"]
        }

    assert len(edges(raw)) == 3
    assert edges(simplified) == {(b.id, c.id)}


@pytest.mark.django_db
def test_balances_endpoint_defaults_to_raw_when_param_missing():
    actor, group, a, b, c = _make_group_with_three_members()
    _expense(actor, group, payer=b, owers=[(a.id, Decimal("5.00")), (b.id, Decimal("5.00"))],
             total=Decimal("10.00"))
    client = APIClient()
    client.force_authenticate(user=actor)
    # No ``simplified`` param at all behaves like simplified=false.
    payload = client.get(f"/api/groups/{group.id}/balances/").json()
    assert payload  # non-empty
    # The same as explicitly false.
    explicit_false = client.get(f"/api/groups/{group.id}/balances/?simplified=false").json()
    assert payload == explicit_false
