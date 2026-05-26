from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_user_avatar_attribution"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="retention_first_notice_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="retention_second_notice_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
