"""Statelessness: any instance can serve any request (HAProxy round-robins
across Girder hosts, and MCP clients do not keep its sticky cookie)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from nimbusimage_mcp import _common
from nimbusimage_mcp.auth import GirderApiKeyVerifier
from nimbusimage_mcp.config import Settings
from nimbusimage_mcp.server import build_app

from conftest import make_settings, serve
from fake_girder import API, FakeGirder
from helpers import call_tool, rpc

KEY = "m" * 40


def test_stateless_requests_any_instance(monkeypatch):
    girder = FakeGirder()
    girder.add_key(KEY, "alice")
    fake = MagicMock()
    fake.list_datasets.return_value = []
    monkeypatch.setattr(_common.ni, "connect", lambda api_url, token: fake)
    settings = make_settings()

    def instance():
        return build_app(settings, GirderApiKeyVerifier(
            API, settings.public_url, http=girder.http()
        ))

    with serve(instance()) as first, serve(instance()) as second:
        init = rpc(first, "initialize", {
            "protocolVersion": "2025-11-25", "capabilities": {},
            "clientInfo": {"name": "test", "version": "0"},
        }, key=KEY)
        assert init.status_code == 200
        # No session to carry to the next request.
        assert "mcp-session-id" not in init.headers
        # The other instance answers without having seen the initialize.
        assert call_tool(second, KEY, "ni_datasets_list", {})["total"] == 0
        assert rpc(first, "tools/list", {}, key=KEY).status_code == 200
    # Each instance exchanged the key once for itself; neither needed
    # the other's state.
    assert girder.exchanges == 2


def test_settings_refuse_a_service_credential():
    for name in ("NI_API_KEY", "NI_TOKEN"):
        with pytest.raises(ValueError, match="must not be set"):
            Settings.from_env({name: "x"})
    settings = Settings.from_env({"NI_MCP_PORT": "9001"})
    assert settings.public_url == "http://localhost:9001/mcp"


def test_public_url_trailing_slash_is_dropped():
    # The metadata path follows public_url, and the proxy matches it
    # exactly.
    settings = Settings.from_env({"NI_MCP_PUBLIC_URL": "https://h/mcp/"})
    assert settings.public_url == "https://h/mcp"
