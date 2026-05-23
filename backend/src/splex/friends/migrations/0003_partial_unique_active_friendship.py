"""Replace the `(participant_a, participant_b, source)` unique constraint with
a partial constraint that enforces uniqueness only on `(participant_a,
participant_b)` for active friendships (`ended_at IS NULL`).

Source becomes purely descriptive metadata; the same pair cannot have both an
`explicit` and a `shared_group` row at the same time. Ended friendships are
excluded from the constraint so unfriend-then-refriend cycles still work.

The previous dedupe migration (0002) is a prerequisite - if duplicates remain
when this migration runs, adding the constraint will fail.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("friends", "0002_dedupe_friendship_pairs"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="friendship",
            name="unique_friendship_pair_source",
        ),
        migrations.AddConstraint(
            model_name="friendship",
            constraint=models.UniqueConstraint(
                fields=["participant_a", "participant_b"],
                condition=models.Q(ended_at__isnull=True),
                name="unique_active_friendship_pair",
            ),
        ),
    ]
