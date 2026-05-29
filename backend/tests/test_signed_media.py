"""Signed media URLs must be stable for a given storage path so URL-keyed
image caches (browser, React Native ``Image``) can reuse the bytes across
API responses.  These tests pin that determinism and the round-trip.
"""

from __future__ import annotations

import pytest
from django.http import Http404

from splex.shared import media


def test_signed_media_url_is_deterministic_for_a_path():
    """Repeated calls for the same path must produce identical URLs.

    Without this, every avatar in every API response gets a fresh URL even
    though the underlying file has not changed, and React Native's
    URL-keyed ``Image`` cache misses on every navigation.
    """
    first = media.signed_media_url("profile-images/me.png")
    second = media.signed_media_url("profile-images/me.png")
    assert first == second
    assert first  # non-empty


def test_signed_media_url_differs_per_path():
    one = media.signed_media_url("profile-images/me.png")
    other = media.signed_media_url("profile-images/you.png")
    assert one != other


def test_storage_path_from_signed_token_round_trips():
    url = media.signed_media_url("profile-images/me.png")
    token = url.rsplit("/", 2)[-2]
    assert media.storage_path_from_signed_token(token) == "profile-images/me.png"


def test_storage_path_rejects_tampered_token():
    url = media.signed_media_url("profile-images/me.png")
    token = url.rsplit("/", 2)[-2]
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(Http404):
        media.storage_path_from_signed_token(tampered)


def test_signed_media_url_returns_empty_for_blank_input():
    assert media.signed_media_url("") == ""
    assert media.signed_media_url(None) == ""
