from decimal import Decimal

import pytest

from splex.shared.money import assert_sum, money, split_evenly


def test_money_rounds_half_up_to_cents():
    assert money("1.005") == Decimal("1.01")
    assert money("1.004") == Decimal("1.00")


def test_split_evenly_distributes_remainder_cents():
    shares = split_evenly(Decimal("10.00"), [3, 1, 2])
    assert shares == {
        1: Decimal("3.34"),
        2: Decimal("3.33"),
        3: Decimal("3.33"),
    }


def test_split_evenly_requires_participants():
    with pytest.raises(ValueError, match="At least one participant"):
        split_evenly(Decimal("10.00"), [])


def test_assert_sum_raises_on_mismatch():
    with pytest.raises(ValueError, match="must sum to 10.00"):
        assert_sum("Shares", [Decimal("3.00"), Decimal("6.00")], Decimal("10.00"))
