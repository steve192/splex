from pathlib import PurePosixPath

from django.conf import settings
from django.core import signing
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404


MEDIA_SIGNER_SALT = "splex.private-media"


def media_storage_path(value: str) -> str:
    if not value:
        return ""
    media_url = settings.MEDIA_URL
    if value.startswith(media_url):
        value = value.removeprefix(media_url)
    elif value.startswith(settings.BACKEND_PUBLIC_URL):
        value = value.removeprefix(settings.BACKEND_PUBLIC_URL)
        if value.startswith(media_url):
            value = value.removeprefix(media_url)
    elif "://" in value:
        raise ValueError("External media URLs are not supported.")
    path = PurePosixPath(value.lstrip("/"))
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Invalid media path.")
    return path.as_posix()


def signed_media_url(value: str) -> str:
    try:
        path = media_storage_path(value)
    except ValueError:
        return ""
    if not path:
        return ""
    token = signing.dumps({"path": path}, salt=MEDIA_SIGNER_SALT)
    return f"{settings.BACKEND_PUBLIC_URL}/api/media/{token}/"


def storage_path_from_signed_token(token: str) -> str:
    try:
        payload = signing.loads(
            token,
            salt=MEDIA_SIGNER_SALT,
            max_age=settings.PRIVATE_MEDIA_URL_MAX_AGE_SECONDS,
        )
        return media_storage_path(payload["path"])
    except (KeyError, signing.BadSignature, signing.SignatureExpired, ValueError) as exc:
        raise Http404("Media not found.") from exc


def private_media_response(path: str) -> FileResponse:
    if not default_storage.exists(path):
        raise Http404("Media not found.")
    return FileResponse(default_storage.open(path, "rb"))
