import base64
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def save_data_url_image(*, data_url: str, folder: str) -> str:
    if not data_url.startswith("data:image/"):
        raise ValueError("Expected an image data URL.")
    header, encoded = data_url.split(",", 1)
    content_type = header.split(";", 1)[0].replace("data:", "")
    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }.get(content_type)
    if not extension:
        raise ValueError("Unsupported image type.")
    payload = base64.b64decode(encoded)
    if len(payload) > 3 * 1024 * 1024:
        raise ValueError("Image is too large.")
    path = default_storage.save(
        f"{folder}/{uuid.uuid4().hex}.{extension}",
        ContentFile(payload),
    )
    return f"{settings.BACKEND_PUBLIC_URL}{settings.MEDIA_URL}{path}"
