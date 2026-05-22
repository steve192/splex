from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("participants", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="participant",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
