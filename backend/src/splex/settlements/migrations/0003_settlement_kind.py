from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settlements", "0002_nullable_user_fk_for_account_deletion"),
    ]

    operations = [
        migrations.AddField(
            model_name="settlement",
            name="kind",
            field=models.CharField(
                choices=[("manual", "Manual"), ("auto_write_off", "Auto write-off")],
                default="manual",
                max_length=20,
            ),
        ),
    ]
