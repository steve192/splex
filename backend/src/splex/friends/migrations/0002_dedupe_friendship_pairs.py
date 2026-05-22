"""Dedupe friendship pairs that have multiple rows due to the old `(a, b, source)`
unique constraint allowing both an `explicit` and a `shared_group` row for the
same pair.

For each (participant_a, participant_b) with more than one active friendship:
1. Pick a keeper — prefer the `explicit` row, otherwise the oldest by id.
2. Re-point every expense, settlement, and activity event that references one
   of the duplicates to point at the keeper instead.
3. Delete the duplicate rows.
"""

from django.db import migrations


def dedupe_pairs(apps, schema_editor):
    Friendship = apps.get_model("friends", "Friendship")
    Expense = apps.get_model("expenses", "Expense")
    Settlement = apps.get_model("settlements", "Settlement")
    ActivityEvent = apps.get_model("activity", "ActivityEvent")

    grouped: dict[tuple[int, int], list] = {}
    for friendship in Friendship.objects.filter(ended_at__isnull=True).order_by("id"):
        key = (friendship.participant_a_id, friendship.participant_b_id)
        grouped.setdefault(key, []).append(friendship)

    for friendships in grouped.values():
        if len(friendships) < 2:
            continue
        keeper = next(
            (f for f in friendships if f.source == "explicit"),
            friendships[0],
        )
        duplicates = [f for f in friendships if f.id != keeper.id]
        duplicate_ids = [f.id for f in duplicates]
        Expense.objects.filter(friendship_id__in=duplicate_ids).update(friendship_id=keeper.id)
        Settlement.objects.filter(friendship_id__in=duplicate_ids).update(friendship_id=keeper.id)
        ActivityEvent.objects.filter(friendship_id__in=duplicate_ids).update(friendship_id=keeper.id)
        Friendship.objects.filter(id__in=duplicate_ids).delete()


def noop_reverse(apps, schema_editor):
    """Dedupe is not reversible — we have no record of which rows were merged."""


class Migration(migrations.Migration):

    dependencies = [
        ("friends", "0001_initial"),
        ("expenses", "0006_alter_expense_location_precision"),
        ("settlements", "0002_nullable_user_fk_for_account_deletion"),
        ("activity", "0002_nullable_user_fk_for_account_deletion"),
    ]

    operations = [
        migrations.RunPython(dedupe_pairs, noop_reverse),
    ]
