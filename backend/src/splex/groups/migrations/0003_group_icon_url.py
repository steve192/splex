from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("groups", "0002_group_archive_and_default_split"),
    ]

    operations = [
        migrations.AddField(
            model_name="group",
            name="icon_url",
            field=models.URLField(blank=True),
        ),
    ]
