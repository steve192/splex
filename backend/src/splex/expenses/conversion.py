from dataclasses import asdict, dataclass
from datetime import date
from decimal import Decimal

from splex.currency.constants import ExchangeRateSource
from splex.currency.services import RATE_PRECISION, convert_for_rate_date, get_rate_for_date
from splex.expenses.models import Expense
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import money

_RATE_FIELD = Expense._meta.get_field("exchange_rate")
MAX_EXCHANGE_RATE = Decimal(10) ** (_RATE_FIELD.max_digits - _RATE_FIELD.decimal_places)


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
    amount: Decimal,
    currency: str,
    context_currency: str,
    rate_date: date,
    amount_paid: Decimal | None,
    payer_shares: dict,
    previous: Expense | None = None,
) -> ExpenseConversion:
    """Convert at the official rate, or at the rate implied by the amount paid.

    Rates stored on `previous` are reused while its currencies and date are unchanged.
    """
    if previous is not None and not _has_same_rate_inputs(
        previous, currency, context_currency, rate_date
    ):
        previous = None
    if amount_paid is None:
        if previous is not None and previous.exchange_rate_source != ExchangeRateSource.MANUAL:
            return _stored_rate_conversion(previous, amount)
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
        currency=currency, context_currency=context_currency, payer_shares=payer_shares
    ):
        raise DomainError(
            ErrorCode.EXPENSE_AMOUNT_PAID_NOT_APPLICABLE,
            "An amount paid needs a foreign-currency expense with a single payer.",
        )
    return _amount_paid_conversion(
        amount=money(amount),
        amount_paid=money(amount_paid),
        official_exchange_rate=(
            _stored_official_rate(previous)
            if previous is not None
            else _official_rate(currency, context_currency, rate_date)
        ),
    )


def is_amount_paid_applicable(*, currency: str, context_currency: str, payer_shares: dict) -> bool:
    payer_count = sum(1 for amount in payer_shares.values() if amount > 0)
    return currency.upper() != context_currency.upper() and payer_count == 1


def _amount_paid_conversion(
    *, amount: Decimal, amount_paid: Decimal, official_exchange_rate: Decimal | None
) -> ExpenseConversion:
    rate = (amount_paid / amount).quantize(RATE_PRECISION) if amount > 0 else Decimal(0)
    if amount_paid <= 0 or not 0 < rate < MAX_EXCHANGE_RATE:
        raise DomainError(
            ErrorCode.EXPENSE_AMOUNT_PAID_INVALID,
            "The amount paid does not fit the expense amount.",
        )
    return ExpenseConversion(
        converted_amount=amount_paid,
        exchange_rate=rate,
        exchange_rate_source=ExchangeRateSource.MANUAL,
        exchange_rate_date=None,
        official_exchange_rate=official_exchange_rate,
    )


def _has_same_rate_inputs(
    expense: Expense, currency: str, context_currency: str, rate_date: date
) -> bool:
    return (
        currency == expense.original_currency
        and context_currency == expense.converted_currency
        and rate_date == expense.date
    )


def _stored_rate_conversion(expense: Expense, amount: Decimal) -> ExpenseConversion:
    return ExpenseConversion(
        converted_amount=(
            expense.converted_amount
            if amount == expense.original_amount
            else money(amount * expense.exchange_rate)
        ),
        exchange_rate=expense.exchange_rate,
        exchange_rate_source=expense.exchange_rate_source,
        exchange_rate_date=expense.exchange_rate_date,
    )


def _stored_official_rate(expense: Expense) -> Decimal | None:
    if expense.exchange_rate_source == ExchangeRateSource.MANUAL:
        return expense.official_exchange_rate
    return expense.exchange_rate


def _official_rate(currency: str, context_currency: str, rate_date: date) -> Decimal | None:
    # The official rate only feeds the markup hint, so an unavailable provider
    # must not block saving an expense whose rate is already known.
    try:
        return get_rate_for_date(currency, context_currency, rate_date).rate
    except DomainError:
        return None
