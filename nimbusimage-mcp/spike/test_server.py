"""Unit tests for the spike's pure helpers.

    NI_API_KEY=unused .venv/bin/python -m pytest spike/test_server.py
"""

import importlib.util
import os
from pathlib import Path

import pydantic_core
from mcp.server.mcpserver import Image

os.environ.setdefault("NI_API_KEY", "unused")
os.environ.setdefault("NI_MCP_CALL_LOG", os.devnull)
_spec = importlib.util.spec_from_file_location(
    "spike_server", Path(__file__).with_name("server.py")
)
server = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(server)


def test_result_size_matches_sdk_wire_format():
    result = {"total": 3, "datasets": [{"id": "a", "name": "b"}]}
    wire = pydantic_core.to_json(result, fallback=str, indent=2)
    assert server._result_size(result) == len(wire)
    # Images travel base64-encoded.
    assert server._result_size(Image(data=b"x" * 10, format="jpeg")) == 16


def test_known_scale_drops_placeholders():
    assert server._known_scale({"value": 1, "unit": "m"}) is None
    assert server._known_scale({"value": 0, "unit": "mm"}) is None
    assert server._known_scale({"value": None, "unit": "mm"}) is None
    assert server._known_scale(None) is None
    real = {"value": 10, "unit": "µm"}
    assert server._known_scale(real) == real


def test_check_crop_clips_and_rejects_empty():
    assert server._check_crop((-5, 10, 120, 50), 100, 80) == (0, 10, 100, 50)
    for bad in ((50, 0, 40, 10), (0, 0, 10, 0), (200, 0, 300, 10)):
        try:
            server._check_crop(bad, 100, 80)
        except ValueError as e:
            assert "empty or outside" in str(e)
        else:
            raise AssertionError(f"accepted {bad}")
