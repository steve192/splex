from pathlib import PurePosixPath

from django.conf import settings
from django.core import signing
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404

MEDIA_SIGNER_SALT = "splex.private-media"

# Plain (non-timestamped) Signer so the token is deterministic for a given
# storage path.  These URLs are only used for non-sensitive media (user
# avatars, group icons) that's already visible to anyone in the same
# group/friendship via the API.  Time-based expiry would only weakly slow
# down link sharing while breaking URL-keyed image caches, so we don't
# bother: signature alone (rotating with SECRET_KEY) is the access boundary.
_media_signer = signing.Signer(salt=MEDIA_SIGNER_SALT)

# How long browsers / image caches may keep a fetched media file without
# revalidating.  The URL itself is stable, so a generous lifetime is safe;
# replacing an avatar yields a new storage path and therefore a new URL.
MEDIA_CACHE_CONTROL_MAX_AGE_SECONDS = 86_400  # 1 day


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


def signed_media_url(value: str | None) -> str:
    if not value:
        return ""
    try:
        path = media_storage_path(value)
    except ValueError:
        return ""
    if not path:
        return ""
    token = _media_signer.sign_object({"path": path})
    return f"{settings.BACKEND_PUBLIC_URL}/api/media/{token}/"


def storage_path_from_signed_token(token: str) -> str:
    try:
        payload = _media_signer.unsign_object(token)
        return media_storage_path(payload["path"])
    except (KeyError, signing.BadSignature, ValueError) as exc:
        raise Http404("Media not found.") from exc


def private_media_response(path: str) -> FileResponse:
    if not default_storage.exists(path):
        raise Http404("Media not found.")
    response = FileResponse(default_storage.open(path, "rb"))
    # The signed URL is deterministic for a given storage path, so the same
    # bytes always live at the same URL.  Tell intermediate caches they may
    # serve the bytes without revalidation - this is what stops the React
    # Native ``Image`` cache from re-fetching avatars on every screen
    # navigation.  A new upload yields a new storage path and therefore a
    # new URL, so cache invalidation is automatic.
    response["Cache-Control"] = (
        f"private, max-age={MEDIA_CACHE_CONTROL_MAX_AGE_SECONDS}, immutable"
    )
    return response
