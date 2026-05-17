from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="archived_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="group",
            name="default_split_method",
            field=models.CharField(default="equal_all", max_length=40),
        ),
        migrations.AddField(
            model_name="group",
            name="default_split_payload",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
