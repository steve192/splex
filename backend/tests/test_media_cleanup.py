"""Filesystem cleanup of uploaded images (user avatars and group icons).

Avatars and group icons are uploaded blobs stored under MEDIA_ROOT.  These tests
pin that the previous blob is physically removed when an image is replaced, and
that a group's icon is removed when the group is permanently purged - so deleted
or replaced pictures don't accumulate on disk forever.
"""

import base64
from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory

import pytest
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from splex.groups.services import create_group, delete_group, update_group


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _png_data_url(color=(200, 30, 30)) -> str:
    """A genuine PNG as a data URL - the upload path decodes and re-encodes it
    with Pillow, so it has to be a real image."""
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color).save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


@pytest.fixture
def media_root():
    with TemporaryDirectory() as tmp:
        with override_settings(MEDIA_ROOT=tmp):
            yield tmp


@pytest.mark.django_db
def test_changing_user_avatar_deletes_previous_blob(media_root):
    user = get_user_model().objects.create_user(email="u@example.com", display_name="U")
    client = _auth_client(user)

    client.patch("/api/me/", {"avatar_image": _png_data_url((10, 10, 10))}, format="json")
    user.refresh_from_db()
    first_path = user.avatar_url
    assert default_storage.exists(first_path)

    client.patch("/api/me/", {"avatar_image": _png_data_url((250, 250, 0))}, format="json")
    user.refresh_from_db()
    second_path = user.avatar_url

    assert second_path != first_path
    assert not default_storage.exists(first_path)  # old blob removed
    assert default_storage.exists(second_path)  # new blob kept


@pytest.mark.django_db
def test_changing_group_icon_deletes_previous_blob(media_root):
    owner = get_user_model().objects.create_user(email="o@example.com", display_name="O")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    update_group(actor=owner, group=group, data={"icon_image": _png_data_url((10, 10, 10))})
    group.refresh_from_db()
    first_path = group.icon_url
    assert default_storage.exists(first_path)

    update_group(actor=owner, group=group, data={"icon_image": _png_data_url((0, 200, 0))})
    group.refresh_from_db()
    second_path = group.icon_url

    assert second_path != first_path
    assert not default_storage.exists(first_path)  # old blob removed
    assert default_storage.exists(second_path)  # new blob kept


@pytest.mark.django_db
def test_purging_group_deletes_its_icon_blob(media_root):
    owner = get_user_model().objects.create_user(email="o@example.com", display_name="O")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    update_group(actor=owner, group=group, data={"icon_image": _png_data_url()})
    group.refresh_from_db()
    icon_path = group.icon_url
    assert default_storage.exists(icon_path)

    # Soft-delete, then backdate past the retention window so the purge removes it.
    delete_group(actor=owner, group=group)
    from splex.groups.models import Group

    Group.objects.filter(pk=group.pk).update(
        deleted_at=timezone.now() - timedelta(days=400)
    )

    call_command("purge_soft_deleted")

    assert not Group.objects.filter(pk=group.pk).exists()  # row hard-deleted
    assert not default_storage.exists(icon_path)  # icon blob removed
