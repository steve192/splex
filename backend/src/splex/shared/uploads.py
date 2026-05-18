import base64
import binascii
from io import BytesIO
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError


MAX_IMAGE_UPLOAD_BYTES = 3 * 1024 * 1024
MAX_IMAGE_PIXELS = 12_000_000


def save_data_url_image(*, data_url: str, folder: str) -> str:
    if not data_url.startswith("data:image/"):
        raise ValueError("Expected an image data URL.")
    try:
        header, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise ValueError("Invalid image data URL.") from exc
    content_type = header.split(";", 1)[0].replace("data:", "")
    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }.get(content_type)
    if not extension:
        raise ValueError("Unsupported image type.")
    try:
        payload = base64.b64decode(encoded, validate=True)
    except binascii.Error as exc:
        raise ValueError("Invalid image encoding.") from exc
    if len(payload) > MAX_IMAGE_UPLOAD_BYTES:
        raise ValueError("Image is too large.")
    payload = validate_and_normalize_image(payload, content_type)
    path = default_storage.save(
        f"{folder}/{uuid.uuid4().hex}.{extension}",
        ContentFile(payload),
    )
    return path


def validate_and_normalize_image(payload: bytes, content_type: str) -> bytes:
    try:
        image = Image.open(BytesIO(payload))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Invalid image file.") from exc
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image dimensions are too large.")

    output = BytesIO()
    if content_type == "image/png":
        image.save(output, format="PNG", optimize=True)
    elif content_type == "image/webp":
        image.save(output, format="WEBP", quality=90, method=6)
    else:
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        image.save(output, format="JPEG", quality=90, optimize=True)

    normalized = output.getvalue()
    if len(normalized) > MAX_IMAGE_UPLOAD_BYTES:
        raise ValueError("Image is too large.")
    return normalized
