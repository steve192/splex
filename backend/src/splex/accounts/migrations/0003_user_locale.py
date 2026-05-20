from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_avatar_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="locale",
            field=models.CharField(default="en", max_length=8),
        ),
    ]
