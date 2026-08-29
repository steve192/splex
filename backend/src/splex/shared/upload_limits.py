"""Byte-size limits for user-supplied image uploads.

Deliberately free of Django (and Pillow) imports: ``config.settings.base``
derives ``DATA_UPLOAD_MAX_MEMORY_SIZE`` from these values while the settings
module is still being evaluated, which rules out importing
``splex.shared.uploads`` itself.
"""

MAX_SOURCE_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_STORED_IMAGE_BYTES = 3 * 1024 * 1024

# Room for the ``data:image/jpeg;base64,`` prefix and the surrounding JSON
# object, including any sibling fields sent in the same request (a group PATCH
# carries a name alongside the icon). Tiny next to the payload itself, so it is
# sized generously rather than computed per endpoint.
_REQUEST_ENVELOPE_SLACK_BYTES = 64 * 1024


def max_request_body_bytes(payload_bytes: int = MAX_SOURCE_IMAGE_UPLOAD_BYTES) -> int:
    """Smallest request-body cap that still admits ``payload_bytes`` as a data URL.

    Images arrive as base64 data URLs inside a JSON body, so the body runs 4/3
    the decoded size (rounded up to whole 4-character blocks) plus the envelope.
    Django's 2.5 MiB default would reject those bodies before
    ``save_data_url_image`` could apply its own limit, turning an intended
    ``IMAGE_TOO_LARGE`` domain error into an opaque 400.
    """
    base64_bytes = -(-payload_bytes // 3) * 4
    return base64_bytes + _REQUEST_ENVELOPE_SLACK_BYTES
