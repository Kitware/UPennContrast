"""Neither the API key nor the Girder session token reaches any log."""

from __future__ import annotations

import json
import logging
from unittest.mock import MagicMock

from nimbusimage_mcp import _common
from nimbusimage_mcp.auth import GirderApiKeyVerifier
from nimbusimage_mcp.server import build_app

from conftest import make_settings, serve
from fake_girder import API, FakeGirder
from helpers import call_tool, rpc

KEY = "s3cr3tK3y" + "q" * 31


def test_no_credentials_in_logs(tmp_path, caplog, monkeypatch):
    girder = FakeGirder()
    girder.add_key(KEY, "alice")
    call_log = tmp_path / "calls.jsonl"
    settings = make_settings(call_log=str(call_log))
    fake = MagicMock()
    fake.list_datasets.return_value = [{"_id": "d1", "name": "Mine"}]
    fake.dataset.side_effect = ValueError("No large image in patient-1234")
    monkeypatch.setattr(_common.ni, "connect", lambda api_url, token: fake)

    caplog.set_level(logging.DEBUG)
    secret_tag = "patient-1234"
    app = build_app(settings, GirderApiKeyVerifier(
        API, settings.public_url, http=girder.http()
    ))
    with serve(app) as url:
        call_tool(url, KEY, "ni_datasets_list",
                  {"name_contains": secret_tag})
        rpc(url, "tools/call", {"name": "ni_dataset_info",
                                "arguments": {"dataset_id": "d1"}}, key=KEY)
        rpc(url, "tools/list", {}, key="w" * 40)  # refused key

    session_tokens = list(girder.tokens)
    assert session_tokens, "the scenario should have minted a session"
    logged = caplog.text + call_log.read_text()
    for secret in [KEY, "w" * 40, *session_tokens]:
        assert secret not in logged

    # Arguments are the user's data: never in the server log, only in the
    # opt-in call log.
    assert secret_tag not in caplog.text
    records = [json.loads(line) for line in call_log.read_text().splitlines()]
    assert records[0]["args"]["name_contains"] == secret_tag
    assert [r["tool"] for r in records] == [
        "ni_datasets_list", "ni_dataset_info",
    ]
    # The caller is identified by user id, and failures are recorded.
    assert {r["user"] for r in records} == {"user0001"}
    assert records[0]["bytes"] > 0 and records[0]["error"] is None
    assert records[1]["error"] == "No large image in patient-1234"
    assert '"error": "bad input"' in caplog.text
