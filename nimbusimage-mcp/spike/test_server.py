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


def test_slice_indexes_match_frontend_resolve_slice():
    # src/store/images.ts resolveSlice + getLayerSliceIndexes
    current = {"type": "current", "value": None}
    assert server._slice_indexes(current, 3, 11) == [3]
    assert server._slice_indexes(None, 3, 11) == [3]
    assert server._slice_indexes({"type": "constant", "value": 7}, 3, 11) \
        == [7]
    assert server._slice_indexes({"type": "constant", "value": None}, 3, 11) \
        == [0]
    assert server._slice_indexes({"type": "offset", "value": -1}, 3, 11) \
        == [2]
    assert server._slice_indexes({"type": "max-merge"}, 3, 4) \
        == [0, 1, 2, 3]


def test_slice_indexes_out_of_range_layer_is_not_drawn():
    assert server._slice_indexes({"type": "offset", "value": 1}, 10, 11) \
        is None
    assert server._slice_indexes({"type": "constant", "value": 20}, 0, 11) \
        is None


def test_single_plane_axis_ignores_slice_setting():
    # The frontend resolves only when the axis has more than one entry.
    assert server._slice_indexes({"type": "offset", "value": 5}, 0, 1) == [0]


def test_result_size_matches_sdk_wire_format():
    result = {"total": 3, "datasets": [{"id": "a", "name": "b"}]}
    wire = pydantic_core.to_json(result, fallback=str, indent=2)
    assert server._result_size(result) == len(wire)
    # Images travel base64-encoded.
    assert server._result_size(Image(data=b"x" * 10, format="jpeg")) == 16
