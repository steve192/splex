"""Add per-participant archive timestamps to Friendship.

Archiving a friend is a personal preference - each side independently decides
whether the friend is tucked away in their own list - so it is stored as two
nullable timestamps (one per side) rather than a single shared flag.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('friends', '0003_partial_unique_active_friendship'),
    ]

    operations = [
        migrations.AddField(
            model_name='friendship',
            name='participant_a_archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='friendship',
            name='participant_b_archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
