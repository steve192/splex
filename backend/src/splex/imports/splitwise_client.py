"""Thin Splitwise REST client used by the import flow.

Only covers the read endpoints we need to mirror a user's data into Splex.
Pagination on ``/get_expenses`` is handled by repeatedly bumping ``offset``
until the server returns a short (or empty) page.
"""

from __future__ import annotations

from collections.abc import Iterator

import requests

SPLITWISE_BASE_URL = "https://secure.splitwise.com/api/v3.0"
# Splitwise does not document a hard maximum for ``limit``; 200 is well below
# any rate limiting we have observed and keeps the round-trip count low.
EXPENSE_PAGE_SIZE = 200
REQUEST_TIMEOUT_SECONDS = 30


class SplitwiseError(Exception):
    """Generic Splitwise client error."""


class SplitwiseAuthError(SplitwiseError):
    """Raised when the Splitwise API key is missing or rejected."""


class SplitwiseClient:
    def __init__(self, api_key: str, *, base_url: str = SPLITWISE_BASE_URL,
                 session: requests.Session | None = None,
                 timeout: int = REQUEST_TIMEOUT_SECONDS) -> None:
        if not api_key or not api_key.strip():
            raise SplitwiseAuthError("Splitwise API key is required.")
        self._api_key = api_key.strip()
        self._base_url = base_url.rstrip("/")
        self._session = session or requests.Session()
        self._timeout = timeout

    def _get(self, path: str, params: dict | None = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }
        try:
            response = self._session.get(
                f"{self._base_url}{path}",
                params=params,
                headers=headers,
                timeout=self._timeout,
            )
        except requests.RequestException as exc:
            raise SplitwiseError(f"Could not reach Splitwise: {exc}") from exc
        if response.status_code in (401, 403):
            raise SplitwiseAuthError("Splitwise rejected the API key.")
        if response.status_code >= 400:
            raise SplitwiseError(
                f"Splitwise request failed ({response.status_code}): "
                f"{response.text[:200]}"
            )
        try:
            return response.json()
        except ValueError as exc:
            raise SplitwiseError("Splitwise returned a non-JSON response.") from exc

    def get_current_user(self) -> dict:
        return self._get("/get_current_user").get("user") or {}

    def get_groups(self) -> list[dict]:
        return self._get("/get_groups").get("groups") or []

    def get_friends(self) -> list[dict]:
        return self._get("/get_friends").get("friends") or []

    def iter_expenses(self, *, group_id: int | None = None,
                      friend_id: int | None = None) -> Iterator[dict]:
        """Yield all expenses for a group or friend, paging until exhausted.

        We page by ``limit``/``offset`` and stop when the server returns fewer
        rows than we asked for - that is Splitwise's "no more pages" signal.
        """
        offset = 0
        while True:
            params: dict = {"limit": EXPENSE_PAGE_SIZE, "offset": offset}
            if group_id is not None:
                params["group_id"] = group_id
            if friend_id is not None:
                params["friend_id"] = friend_id
            page = self._get("/get_expenses", params=params).get("expenses") or []
            yield from page
            if len(page) < EXPENSE_PAGE_SIZE:
                return
            offset += EXPENSE_PAGE_SIZE
