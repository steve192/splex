from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def split_evenly(total: Decimal, participant_ids):
    participant_ids = list(participant_ids)
    if not participant_ids:
        raise ValueError("At least one participant is required.")
    cents = int((money(total) * 100).to_integral_value())
    base = cents // len(participant_ids)
    remainder = cents % len(participant_ids)
    shares = {}
    for index, participant_id in enumerate(sorted(participant_ids)):
        share_cents = base + (1 if index < remainder else 0)
        shares[participant_id] = money(Decimal(share_cents) / Decimal("100"))
    return shares


def assert_sum(name: str, amounts, expected: Decimal) -> None:
    actual = money(sum((money(amount) for amount in amounts), Decimal("0")))
    if actual != money(expected):
        raise ValueError(f"{name} must sum to {money(expected)}; got {actual}.")

