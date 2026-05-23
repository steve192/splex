"""Shared soft-delete manager pattern.

The codebase has several "this row still exists but is inactive" flags that
each model named differently for historical reasons:
  - Participant.deleted_at
  - Expense.deleted_at
  - Settlement.deleted_at
  - Group.deleted_at         (`archived_at` is a separate user-controlled flag)
  - GroupMembership.removed_at
  - Friendship.ended_at

Every query that should exclude inactive rows has to remember to filter the
right field. To make that uniform - and to make "I want the live rows" a
single discoverable call - soft-deletable models declare their flag via the
class attribute `SOFT_DELETE_FIELD` and use `SoftDeletableManager` as their
default manager. New code should prefer `Model.objects.active()` instead of
re-typing the filter inline.

The default `objects` queryset still returns ALL rows so existing code paths
and the admin keep working unchanged; this is opt-in, not silently filtered.
"""
from __future__ import annotations

from django.db import models


class SoftDeletableQuerySet(models.QuerySet):
    """Adds `.active()` / `.inactive()` shortcuts based on `SOFT_DELETE_FIELD`."""

    def active(self) -> SoftDeletableQuerySet:
        field = getattr(self.model, "SOFT_DELETE_FIELD", None)
        if field is None:
            raise AttributeError(
                f"{self.model.__name__} uses SoftDeletableManager but does not declare "
                "SOFT_DELETE_FIELD (e.g. 'deleted_at', 'removed_at', 'ended_at')."
            )
        return self.filter(**{f"{field}__isnull": True})

    def inactive(self) -> SoftDeletableQuerySet:
        field = getattr(self.model, "SOFT_DELETE_FIELD", None)
        if field is None:
            raise AttributeError(
                f"{self.model.__name__} uses SoftDeletableManager but does not declare "
                "SOFT_DELETE_FIELD."
            )
        return self.filter(**{f"{field}__isnull": False})


SoftDeletableManager = models.Manager.from_queryset(SoftDeletableQuerySet)
