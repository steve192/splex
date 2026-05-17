from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0003_group_icon_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
