from dataclasses import asdict, dataclass
from datetime import date
from decimal import Decimal

from splex.currency.constants import ExchangeRateSource
from splex.currency.services import RATE_PRECISION, convert_for_rate_date, get_rate_for_date
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import money


@dataclass(frozen=True)
class ExpenseConversion:
    """Conversion of an expense into its context currency, named like the model fields."""

    converted_amount: Decimal
    exchange_rate: Decimal
    exchange_rate_source: str
    exchange_rate_date: date | None
    official_exchange_rate: Decimal | None = None

    def model_fields(self) -> dict:
        return asdict(self)


def resolve_expense_conversion(
    *,
    amount,
    currency: str,
    context_currency: str,
    rate_date: date,
    amount_paid,
    payer_count: int,
) -> ExpenseConversion:
    """Convert at the official rate, or at the rate implied by the amount paid."""
    if amount_paid is None:
        converted_amount, rate = convert_for_rate_date(
            amount, currency, context_currency, rate_date
        )
        return ExpenseConversion(
            converted_amount=converted_amount,
            exchange_rate=rate.rate,
            exchange_rate_source=rate.source,
            exchange_rate_date=rate.rate_date,
        )
    if not is_amount_paid_applicable(
        currency=currency, context_currency=context_currency, payer_count=payer_count
    ):
        raise DomainError(
            ErrorCode.EXPENSE_AMOUNT_PAID_NOT_APPLICABLE,
            "An amount paid needs a foreign-currency expense with a single payer.",
        )
    amount, amount_paid = money(amount), money(amount_paid)
    if amount <= 0 or amount_paid <= 0:
        raise DomainError(
            ErrorCode.EXPENSE_AMOUNT_PAID_INVALID,
            "The amount and the amount paid must be greater than zero.",
        )
    return ExpenseConversion(
        converted_amount=amount_paid,
        exchange_rate=(amount_paid / amount).quantize(RATE_PRECISION),
        exchange_rate_source=ExchangeRateSource.MANUAL,
        exchange_rate_date=None,
        official_exchange_rate=_official_rate(currency, context_currency, rate_date),
    )


def is_amount_paid_applicable(*, currency: str, context_currency: str, payer_count: int) -> bool:
    return currency.upper() != context_currency.upper() and payer_count == 1


def _official_rate(currency: str, context_currency: str, rate_date: date) -> Decimal | None:
    # The official rate only feeds the markup hint, so an unavailable provider
    # must not block saving an expense whose rate is already known.
    try:
        return get_rate_for_date(currency, context_currency, rate_date).rate
    except DomainError:
        return None
