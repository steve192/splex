import base64
import binascii
import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps

JPEG_CONTENT_TYPE = "image/jpeg"
PNG_CONTENT_TYPE = "image/png"
WEBP_CONTENT_TYPE = "image/webp"
MAX_SOURCE_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_STORED_IMAGE_BYTES = 3 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_DIMENSION = 1600
JPEG_QUALITY_STEPS = (88, 80, 72, 64)
WEBP_QUALITY_STEPS = (88, 80, 72, 64)
SCALE_PERCENT_STEPS = (100, 80, 65)


def save_data_url_image(*, data_url: str, folder: str) -> str:
    if not data_url.startswith("data:image/"):
        raise ValueError("Expected an image data URL.")
    try:
        header, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise ValueError("Invalid image data URL.") from exc
    content_type = header.split(";", 1)[0].replace("data:", "")
    extension = {
        JPEG_CONTENT_TYPE: "jpg",
        PNG_CONTENT_TYPE: "png",
        WEBP_CONTENT_TYPE: "webp",
    }.get(content_type)
    if not extension:
        raise ValueError("Unsupported image type.")
    try:
        payload = base64.b64decode(encoded, validate=True)
    except binascii.Error as exc:
        raise ValueError("Invalid image encoding.") from exc
    if len(payload) > MAX_SOURCE_IMAGE_UPLOAD_BYTES:
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
    except OSError as exc:
        raise ValueError("Invalid image file.") from exc
    image = ImageOps.exif_transpose(image)
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image dimensions are too large.")

    image = resize_image(image)
    normalized = encode_image(image, content_type)
    if len(normalized) > MAX_STORED_IMAGE_BYTES:
        raise ValueError("Image is too large.")
    return normalized


def resize_image(image: Image.Image) -> Image.Image:
    resized = image.copy()
    resized.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
    return resized


def encode_image(image: Image.Image, content_type: str) -> bytes:
    if content_type == PNG_CONTENT_TYPE:
        return encode_png_candidates(image)
    return encode_lossy_candidates(image, content_type)


def encode_png_candidates(image: Image.Image) -> bytes:
    smallest_candidate = b""
    for scaled_image in iter_scaled_images(image):
        candidate = encode_png(scaled_image)
        if not smallest_candidate or len(candidate) < len(smallest_candidate):
            smallest_candidate = candidate
        if len(candidate) <= MAX_STORED_IMAGE_BYTES:
            return candidate

    return smallest_candidate


def encode_lossy_candidates(image: Image.Image, content_type: str) -> bytes:
    smallest_candidate = b""
    quality_steps = WEBP_QUALITY_STEPS if content_type == WEBP_CONTENT_TYPE else JPEG_QUALITY_STEPS
    for scaled_image in iter_scaled_images(image):
        for quality in quality_steps:
            candidate = encode_lossy_image(scaled_image, content_type, quality)
            if not smallest_candidate or len(candidate) < len(smallest_candidate):
                smallest_candidate = candidate
            if len(candidate) <= MAX_STORED_IMAGE_BYTES:
                return candidate

    return smallest_candidate


def iter_scaled_images(image: Image.Image):
    width, height = image.size
    for scale_percent in SCALE_PERCENT_STEPS:
        if scale_percent == 100:
            yield image
            continue
        scaled_width = max(1, width * scale_percent // 100)
        scaled_height = max(1, height * scale_percent // 100)
        yield image.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)


def encode_png(image: Image.Image) -> bytes:
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def encode_lossy_image(image: Image.Image, content_type: str, quality: int) -> bytes:
    output = BytesIO()
    if content_type == WEBP_CONTENT_TYPE:
        normalized_image = image if image.mode in {"RGB", "RGBA"} else image.convert("RGBA")
        normalized_image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()

    normalized_image = image if image.mode in {"RGB", "L"} else image.convert("RGB")
    normalized_image.save(output, format="JPEG", quality=quality, optimize=True)
    return output.getvalue()
