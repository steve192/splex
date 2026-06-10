"""Tests for the client-IP / proxy trust used by DRF rate limiting.

DRF derives the throttle key from the client IP.  Without a pinned NUM_PROXIES
it trusts a client-supplied X-Forwarded-For header, which lets an attacker
rotate the header to get a fresh throttle bucket per request and bypass every
IP-based limit.  These tests lock in the safe behaviour.
"""

from django.test import RequestFactory
from rest_framework.settings import api_settings
from rest_framework.throttling import BaseThrottle

from tests.test_database_settings import load_base_settings


def test_num_proxies_defaults_to_zero_without_proxy(monkeypatch):
    settings_module = load_base_settings(monkeypatch, APP_BEHIND_PROXY="false")
    assert settings_module.NUM_PROXIES == 0
    assert settings_module.REST_FRAMEWORK["NUM_PROXIES"] == 0


def test_num_proxies_defaults_to_one_behind_proxy(monkeypatch):
    settings_module = load_base_settings(monkeypatch, APP_BEHIND_PROXY="true")
    assert settings_module.NUM_PROXIES == 1
    assert settings_module.REST_FRAMEWORK["NUM_PROXIES"] == 1


def test_num_proxies_explicit_override_wins(monkeypatch):
    settings_module = load_base_settings(
        monkeypatch, APP_BEHIND_PROXY="true", NUM_PROXIES="2"
    )
    assert settings_module.NUM_PROXIES == 2
    assert settings_module.REST_FRAMEWORK["NUM_PROXIES"] == 2


def test_forged_xff_ignored_when_not_behind_proxy(monkeypatch):
    """NUM_PROXIES=0: a client-supplied X-Forwarded-For must be ignored."""
    monkeypatch.setattr(api_settings, "NUM_PROXIES", 0)
    request = RequestFactory().get(
        "/", HTTP_X_FORWARDED_FOR="1.2.3.4", REMOTE_ADDR="10.0.0.1"
    )
    assert BaseThrottle().get_ident(request) == "10.0.0.1"


def test_forged_xff_prefix_ignored_behind_one_proxy(monkeypatch):
    """NUM_PROXIES=1: the trusted proxy appends the real client IP at the end;
    an attacker-supplied prefix must not influence the throttle identity."""
    monkeypatch.setattr(api_settings, "NUM_PROXIES", 1)
    request = RequestFactory().get(
        "/",
        HTTP_X_FORWARDED_FOR="9.9.9.9, 5.6.7.8",  # 9.9.9.9 is attacker-forged
        REMOTE_ADDR="10.0.0.1",
    )
    assert BaseThrottle().get_ident(request) == "5.6.7.8"
