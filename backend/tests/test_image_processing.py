"""Unit-level tests for splex.shared.uploads image validation/normalization.

These exercise the error branches and the PNG/WEBP/JPEG encoding paths that
the API-level tests in test_uploads.py don't reach.
"""

import base64
from io import BytesIO
from unittest.mock import patch

import pytest
from PIL import Image

from splex.shared import uploads
from splex.shared.uploads import (
    save_data_url_image,
    validate_and_normalize_image,
)


def _image_bytes(mode="RGB", size=(64, 48), fmt="PNG"):
    buffer = BytesIO()
    Image.new(mode, size, color=(123, 222, 64) if mode == "RGB" else None).save(buffer, format=fmt)
    return buffer.getvalue()


def _data_url(content_type, payload: bytes):
    return f"data:{content_type};base64,{base64.b64encode(payload).decode()}"


# --- save_data_url_image error branches ---------------------------------------


def test_rejects_non_image_data_url():
    with pytest.raises(ValueError, match="Expected an image data URL"):
        save_data_url_image(data_url="data:text/plain;base64,Zm9v", folder="avatars")


def test_rejects_malformed_data_url_without_comma():
    with pytest.raises(ValueError, match="Invalid image data URL"):
        save_data_url_image(data_url="data:image/png;base64NO-COMMA", folder="avatars")


def test_rejects_unsupported_image_type():
    with pytest.raises(ValueError, match="Unsupported image type"):
        save_data_url_image(data_url="data:image/gif;base64,Zm9v", folder="avatars")


def test_rejects_invalid_base64_encoding():
    with pytest.raises(ValueError, match="Invalid image encoding"):
        save_data_url_image(data_url="data:image/png;base64,not@@@base64", folder="avatars")


def test_rejects_oversized_source_payload():
    payload = b"\x00" * (uploads.MAX_SOURCE_IMAGE_UPLOAD_BYTES + 1)
    with pytest.raises(ValueError, match="too large"):
        save_data_url_image(data_url=_data_url("image/png", payload), folder="avatars")


def test_rejects_valid_base64_that_is_not_an_image():
    data_url = _data_url("image/png", b"hello, not an image")
    with pytest.raises(ValueError, match="Invalid image file"):
        save_data_url_image(data_url=data_url, folder="avatars")


def test_save_data_url_image_stores_and_returns_path():
    data_url = _data_url("image/jpeg", _image_bytes(fmt="JPEG"))
    with patch("splex.shared.uploads.default_storage.save", return_value="avatars/x.jpg") as save:
        path = save_data_url_image(data_url=data_url, folder="avatars")
    assert path == "avatars/x.jpg"
    assert save.call_args[0][0].startswith("avatars/")
    assert save.call_args[0][0].endswith(".jpg")


# --- validate_and_normalize_image: format paths -------------------------------


def test_normalizes_png_image():
    result = validate_and_normalize_image(_image_bytes(fmt="PNG"), "image/png")
    assert isinstance(result, bytes) and len(result) > 0
    assert Image.open(BytesIO(result)).format == "PNG"


def test_normalizes_jpeg_image():
    result = validate_and_normalize_image(_image_bytes(fmt="JPEG"), "image/jpeg")
    assert Image.open(BytesIO(result)).format == "JPEG"


def test_normalizes_webp_image():
    result = validate_and_normalize_image(_image_bytes(fmt="WEBP"), "image/webp")
    assert Image.open(BytesIO(result)).format == "WEBP"


def test_jpeg_encoding_converts_rgba_source_to_rgb():
    # An RGBA PNG re-encoded as JPEG must hit the convert("RGB") branch.
    result = validate_and_normalize_image(_image_bytes(mode="RGBA", fmt="PNG"), "image/jpeg")
    assert Image.open(BytesIO(result)).format == "JPEG"


def test_webp_encoding_converts_palette_source_to_rgba():
    # A palette ("P") image re-encoded as WEBP must hit the convert("RGBA") branch.
    result = validate_and_normalize_image(_image_bytes(mode="P", fmt="PNG"), "image/webp")
    assert Image.open(BytesIO(result)).format == "WEBP"


def test_rejects_images_exceeding_pixel_budget(monkeypatch):
    monkeypatch.setattr(uploads, "MAX_IMAGE_PIXELS", 1)
    with pytest.raises(ValueError, match="dimensions are too large"):
        validate_and_normalize_image(_image_bytes(size=(10, 10), fmt="PNG"), "image/png")
