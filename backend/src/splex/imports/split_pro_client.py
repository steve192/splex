"""Thin read-only client for a Split Pro PostgreSQL database.

Split Pro stores everything in a single PostgreSQL schema (see its Prisma
schema for the full model).  This client exposes the small subset of queries
we need for the import flow and shields callers from psycopg specifics.

All amounts come back as ``BigInt`` in the smallest currency unit, exactly as
Split Pro stores them - the conversion to ``Decimal`` happens in the import
service which also knows the per-currency decimal precision.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row

CONNECT_TIMEOUT_SECONDS = 10
QUERY_TIMEOUT_MS = 30_000


class SplitProError(Exception):
    """Generic Split Pro client error - typically a DB connection issue."""


class SplitProAuthError(SplitProError):
    """Raised when the database rejects the supplied credentials."""


class SplitProSchemaError(SplitProError):
    """Raised when expected Split Pro tables/columns are missing.

    The error message names the missing object so the user can tell whether
    their Split Pro version is newer than what we support.
    """


@dataclass
class SplitProConnection:
    host: str
    port: int
    dbname: str
    user: str
    password: str


class SplitProClient:
    """Read-only adapter for a Split Pro PostgreSQL database."""

    def __init__(self, connection: SplitProConnection) -> None:
        self._connection = connection
        self._conn: psycopg.Connection | None = None

    def __enter__(self) -> SplitProClient:
        try:
            self._conn = psycopg.connect(
                host=self._connection.host,
                port=self._connection.port,
                dbname=self._connection.dbname,
                user=self._connection.user,
                password=self._connection.password,
                connect_timeout=CONNECT_TIMEOUT_SECONDS,
                # Read-only: every query should be a SELECT.
                autocommit=True,
            )
        except psycopg.OperationalError as exc:
            message = str(exc).lower()
            if "authentication" in message or "password" in message:
                raise SplitProAuthError(
                    "Split Pro rejected the database credentials."
                ) from exc
            raise SplitProError(f"Could not connect to Split Pro: {exc}") from exc
        # Bound query time so a slow / hung server cannot stall the request
        # indefinitely.  ``SET`` does not accept bind parameters, so we inline
        # the int constant - safe because the value is module-controlled.
        with self._conn.cursor() as cur:
            cur.execute(f"SET statement_timeout = {int(QUERY_TIMEOUT_MS)}")
        return self

    def __exit__(self, *_exc_info) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def _fetchall(self, query: str, params: tuple = ()) -> list[dict]:
        assert self._conn is not None, "SplitProClient used outside its context"
        try:
            with self._conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, params)
                return list(cur.fetchall())
        except psycopg.errors.UndefinedTable as exc:
            raise SplitProSchemaError(
                f"Split Pro table is missing: {exc}. The connected database "
                "may not be a Split Pro deployment, or its schema has "
                "changed in a way Splex does not yet understand."
            ) from exc
        except psycopg.errors.UndefinedColumn as exc:
            raise SplitProSchemaError(
                f"Split Pro column is missing: {exc}. Splex may need to be "
                "updated to support this Split Pro version."
            ) from exc
        except psycopg.Error as exc:
            raise SplitProError(f"Split Pro query failed: {exc}") from exc

    # ----- user lookup -------------------------------------------------

    def find_user_by_email(self, email: str) -> dict | None:
        rows = self._fetchall(
            'SELECT id, name, email FROM public."User" WHERE LOWER(email) = LOWER(%s) LIMIT 1',
            (email,),
        )
        return rows[0] if rows else None

    def list_users(self) -> list[dict]:
        """Return every Split Pro user.

        Used to render the "which user are you?" picker - we cannot rely on
        an email match because not every Split Pro user has an email set, and
        a user's Splex email may differ from their Split Pro email.
        """
        return self._fetchall(
            'SELECT id, name, email FROM public."User" ORDER BY name NULLS LAST, id'
        )

    def get_user(self, user_id: int) -> dict | None:
        rows = self._fetchall(
            'SELECT id, name, email FROM public."User" WHERE id = %s',
            (int(user_id),),
        )
        return rows[0] if rows else None

    def get_users(self, user_ids: Iterable[int]) -> list[dict]:
        ids = [int(uid) for uid in user_ids]
        if not ids:
            return []
        return self._fetchall(
            'SELECT id, name, email FROM public."User" WHERE id = ANY(%s)',
            (ids,),
        )

    # ----- groups ------------------------------------------------------

    def get_groups_for_user(self, user_id: int) -> list[dict]:
        return self._fetchall(
            '''
            SELECT g.id, g.name, g."defaultCurrency", g."archivedAt"
            FROM public."Group" g
            JOIN public."GroupUser" gu ON gu."groupId" = g.id
            WHERE gu."userId" = %s
            ORDER BY g.id
            ''',
            (user_id,),
        )

    def get_group_members(self, group_id: int) -> list[int]:
        rows = self._fetchall(
            'SELECT "userId" FROM public."GroupUser" WHERE "groupId" = %s',
            (group_id,),
        )
        return [row["userId"] for row in rows]

    # ----- expenses ----------------------------------------------------

    def get_group_expenses(self, group_id: int) -> list[dict]:
        return self._fetchall(
            '''
            SELECT id, name, "paidBy", amount, "splitType", "expenseDate",
                   currency, "deletedAt"
            FROM public."Expense"
            WHERE "groupId" = %s AND "deletedAt" IS NULL
            ORDER BY "expenseDate"
            ''',
            (group_id,),
        )

    def get_friend_expenses(self, user_id: int) -> list[dict]:
        """Non-group expenses the user is a participant in."""
        return self._fetchall(
            '''
            SELECT DISTINCT e.id, e.name, e."paidBy", e.amount, e."splitType",
                   e."expenseDate", e.currency, e."deletedAt"
            FROM public."Expense" e
            JOIN public."ExpenseParticipant" ep ON ep."expenseId" = e.id
            WHERE e."groupId" IS NULL AND e."deletedAt" IS NULL
              AND ep."userId" = %s
            ORDER BY e."expenseDate"
            ''',
            (user_id,),
        )

    def get_participants_for_expenses(self, expense_ids: Iterable) -> dict:
        """Return ``{expense_id: [{userId, amount}, ...]}`` for the given ids."""
        ids = list(expense_ids)
        if not ids:
            return {}
        rows = self._fetchall(
            '''
            SELECT "expenseId", "userId", amount
            FROM public."ExpenseParticipant"
            WHERE "expenseId" = ANY(%s)
            ''',
            (ids,),
        )
        out: dict[Any, list[dict]] = {}
        for row in rows:
            out.setdefault(row["expenseId"], []).append(
                {"userId": row["userId"], "amount": row["amount"]}
            )
        return out
