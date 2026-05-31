"""Switch ActivityEvent.group / .friendship from CASCADE to SET_NULL.

So that activity history survives the data-retention purge of the group or
friendship it describes, instead of being cascade-deleted with it.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activity', '0002_nullable_user_fk_for_account_deletion'),
        ('friends', '0004_friendship_archive'),
        ('groups', '0006_group_icon_attribution'),
    ]

    operations = [
        migrations.AlterField(
            model_name='activityevent',
            name='friendship',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='friends.friendship'),
        ),
        migrations.AlterField(
            model_name='activityevent',
            name='group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='groups.group'),
        ),
    ]
