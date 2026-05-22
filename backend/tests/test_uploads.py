import base64
import os
from io import BytesIO
from tempfile import TemporaryDirectory

import pytest
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient

from splex.groups.services import create_group
from splex.shared.uploads import (
    MAX_SOURCE_IMAGE_UPLOAD_BYTES,
    MAX_STORED_IMAGE_BYTES,
    save_data_url_image,
)


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _large_jpeg_data_url() -> str:
    image = Image.frombytes("RGB", (2600, 2600), os.urandom(2600 * 2600 * 3))
    output = BytesIO()
    image.save(output, format="JPEG", quality=95)
    payload = output.getvalue()
    assert len(payload) > MAX_STORED_IMAGE_BYTES
    assert len(payload) < MAX_SOURCE_IMAGE_UPLOAD_BYTES
    return "data:image/jpeg;base64," + base64.b64encode(payload).decode("ascii")


@pytest.mark.django_db
def test_me_patch_accepts_large_photo_and_stores_normalized_image():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")

    with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
        response = _auth_client(user).patch(
            "/api/me/",
            {"avatar_image": _large_jpeg_data_url()},
            format="json",
        )

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.avatar_url
        assert default_storage.size(user.avatar_url) <= MAX_STORED_IMAGE_BYTES


@pytest.mark.django_db
def test_group_patch_accepts_large_photo_and_stores_normalized_image():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")

    with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
        response = _auth_client(user).patch(
            f"/api/groups/{group.id}/",
            {"icon_image": _large_jpeg_data_url()},
            format="json",
        )

        assert response.status_code == 200
        group.refresh_from_db()
        assert group.icon_url
        assert default_storage.size(group.icon_url) <= MAX_STORED_IMAGE_BYTES


@pytest.mark.django_db
def test_save_data_url_image_rejects_source_payload_above_limit():
    oversized_payload = base64.b64encode(b"0" * (MAX_SOURCE_IMAGE_UPLOAD_BYTES + 1)).decode("ascii")

    with pytest.raises(ValueError, match="Image is too large"):
        save_data_url_image(
            data_url=f"data:image/jpeg;base64,{oversized_payload}",
            folder="profile-images",
        )