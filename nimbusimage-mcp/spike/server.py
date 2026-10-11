"""Phase 0 spike: a read-only MCP server over the nimbusimage package.

See codebaseDocumentation/NIMBUSIMAGE_MCP_SERVER.md, Phase 0. Throwaway code:
single-user auth from NI_API_URL / NI_API_KEY, bound to 127.0.0.1, no auth on
the MCP endpoint itself. What we keep is the measurements in spike/RESULTS.md.

Run:
    NI_API_URL=http://localhost:8080/api/v1 NI_API_KEY=<key> \
        .venv/bin/python spike/server.py
"""

from __future__ import annotations

import functools
import io
import json
import logging
import math
import os
import sys
import time
from pathlib import Path
from typing import Literal

import girder_client
import numpy as np
import pydantic_core
import requests
from mcp.server import MCPServer
from mcp.server.mcpserver import Image
from mcp.server.mcpserver.exceptions import ToolError
from mcp_types import ToolAnnotations
from PIL import Image as PILImage

import nimbusimage as ni
from nimbusimage.images import _parse_color

MAX_DATASETS = 200
DEFAULT_MAX_SIZE = 1024
MAX_IMAGE_SIZE = 2048
# The frontend's histogram request (GirderAPI.baseHistogramOptions); its
# min/max are what percentile contrast is a percentage of.
HISTOGRAM_PARAMS = {
    "bins": 4096, "width": 2048, "height": 2048,
    "resample": "false", "cache": "none",
}

LOG_PATH = Path(
    os.environ.get("NI_MCP_CALL_LOG", Path(__file__).parent / "calls.jsonl")
)
log = logging.getLogger("nimbusimage_mcp_spike")
logging.basicConfig(
    stream=sys.stderr, level=logging.INFO,
    format="%(asctime)s %(name)s %(message)s",
)

READ_ONLY = ToolAnnotations(readOnlyHint=True, openWorldHint=False)

mcp = MCPServer(
    name="nimbusimage",
    instructions=(
        "Tools for NimbusImage, a microscopy image viewer and annotation "
        "platform. Datasets are multidimensional images (channels, z-slices, "
        "time points, XY positions) with annotations (points for spots, "
        "polygons for cells/nuclei, lines, rectangles). Every tool takes a "
        "dataset_id; use ni_datasets_list to find it. Prefer counts and "
        "summaries over listing rows."
    ),
)


@functools.cache
def _client() -> ni.NimbusClient:
    # Spike only: one user, credentials from the environment. Phase 1
    # replaces this with a per-request client built from the bearer token.
    return ni.connect(
        os.environ.get("NI_API_URL", "http://localhost:8080/api/v1"),
        api_key=os.environ["NI_API_KEY"],
    )


def _result_size(result) -> int:
    """Bytes on the wire: the SDK sends images base64-encoded and other
    results as indented JSON (func_metadata's to_json(indent=2))."""
    if isinstance(result, Image):
        return 4 * math.ceil(len(result.data or b"") / 3)
    return len(pydantic_core.to_json(result, fallback=str, indent=2))


def _girder_message(e: girder_client.HttpError) -> str:
    try:
        return json.loads(e.responseText).get("message", "")
    except (ValueError, AttributeError):
        return ""


def _tool_error(e: girder_client.HttpError) -> ToolError:
    if e.status == 401:
        # Likely an expired session token: forget the client so the next
        # call exchanges the API key again.
        _client.cache_clear()
        return ToolError(
            "Authentication with NimbusImage failed; the server's API key "
            "may be invalid or expired. Retry once; if it fails again, the "
            "key needs replacing."
        )
    if e.status == 403:
        return ToolError(
            "Access denied: you do not have permission to read this dataset."
        )
    if e.status == 400:
        # Girder answers 400, not 404, for an id that matches no folder.
        return ToolError(f"Invalid request: {_girder_message(e)}")
    if e.status == 404:
        return ToolError("Not found.")
    return ToolError(f"NimbusImage server error ({e.status}).")


def instrumented(fn):
    """Log tool name, duration, and wire size; map Girder errors.

    The call log is the spike's measurement output (see RESULTS.md).
    """

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        error = None
        result = None
        succeeded = False
        try:
            result = fn(*args, **kwargs)
            succeeded = True
            return result
        except girder_client.HttpError as e:
            error = f"HTTP {e.status}"
            raise _tool_error(e) from None
        except requests.ConnectionError:
            error = "connection"
            raise ToolError("Could not reach the NimbusImage server.") \
                from None
        except ValueError as e:
            # nimbusimage reports bad input as ValueError ("No large image
            # found in dataset ..."); those messages are meant for the user.
            error = str(e)
            raise ToolError(str(e)) from None
        finally:
            elapsed = time.perf_counter() - start
            if not succeeded and error is None:
                # Not one of the mapped errors above; the SDK reports it.
                error = "unhandled"
            record = {
                "ts": time.time(), "tool": fn.__name__,
                "args": kwargs, "seconds": round(elapsed, 3),
                "bytes": _result_size(result) if succeeded else None,
                "error": error,
            }
            log.info(json.dumps(record, default=str))
            with LOG_PATH.open("a") as f:
                f.write(json.dumps(record, default=str) + "\n")

    return wrapper


def _view_and_configuration(dataset_id: str) -> tuple[dict, dict]:
    """The caller's own dataset view and the meta of the configuration it
    points at, which together hold what the app shows them: layers,
    contrast overrides, and scales. Falls back to any readable view (a
    dataset shared with the caller that they have not opened yet)."""
    gc = _client().girder
    views = gc.get(
        "dataset_view",
        parameters={"datasetId": dataset_id, "currentUserOnly": "true"},
    ) or gc.get("dataset_view", parameters={"datasetId": dataset_id})
    if not views:
        return {}, {}
    configuration = gc.get(f"upenn_collection/{views[0]['configurationId']}")
    return views[0], configuration.get("meta", {})


@mcp.tool(annotations=READ_ONLY)
@instrumented
def ni_datasets_list(
    name_contains: str | None = None, limit: int = 50
) -> dict:
    """List the NimbusImage datasets (image sets / experiments) the user can
    open. Returns {total, returned, datasets: [{id, name}]}. Use
    name_contains to find a dataset by part of its name (case-insensitive).
    Results are capped at `limit` (max 200).
    """
    limit = max(1, min(limit, MAX_DATASETS))
    # Spike: list_datasets() finds datasets through their views and fetches
    # each folder separately (one request per dataset). See RESULTS.md.
    folders = _client().list_datasets()
    if name_contains:
        needle = name_contains.lower()
        folders = [f for f in folders if needle in f["name"].lower()]
    return {
        "total": len(folders),
        "returned": min(len(folders), limit),
        "datasets": [
            {"id": f["_id"], "name": f["name"]} for f in folders[:limit]
        ],
    }


@mcp.tool(annotations=READ_ONLY)
@instrumented
def ni_dataset_info(dataset_id: str) -> dict:
    """Describe one dataset: name, image size, channels, and how many
    z-slices, time points, and XY positions (fields of view) it has, plus
    pixel size, z step, and bit depth. pixel_size is null when unknown.
    Use this before fetching images.
    """
    ds = _client().dataset(dataset_id)
    height, width = ds.shape
    view, configuration = _view_and_configuration(dataset_id)
    # The app's precedence: the user's view scales over the configuration's
    # (store getter `scales`). Neither set: the file's own calibration.
    scales = {**configuration.get("scales", {}), **view.get("scales", {})}
    pixel_size = scales.get("pixelSize")
    if pixel_size is None and ds.mm_x is not None:
        pixel_size = {"value": ds.mm_x * 1000, "unit": "µm"}
    return {
        "id": ds.id,
        "name": ds.name,
        "width": width,
        "height": height,
        "dtype": ds.dtype,
        "channels": [
            {"index": i, "name": name} for i, name in enumerate(ds.channels)
        ],
        "num_z": ds.num_z,
        "num_time": ds.num_time,
        "num_xy": ds.num_xy,
        "pixel_size": pixel_size,
        "z_step": scales.get("zStep"),
        "magnification": ds.magnification,
    }


@mcp.tool(annotations=READ_ONLY)
@instrumented
def ni_annotations_count(
    dataset_id: str,
    shape: Literal["point", "polygon", "line", "rectangle"] | None = None,
    tags: list[str] | None = None,
) -> dict:
    """Count annotations (spots, cells, nuclei, ROIs) in a dataset.

    Optionally filter by shape (point = spots, polygon = cells/nuclei,
    line, rectangle) and by tags (an annotation must have all the given
    tags). Returns one number. Use this before listing annotations.
    """
    # Not ds.annotations.count(): it builds the query string by hand, so a
    # tag like "CD8+" reaches the server as "CD8 ". parameters= encodes.
    parameters = {"datasetId": dataset_id}
    if shape:
        parameters["shape"] = shape
    if tags:
        parameters["tags"] = json.dumps(tags)
    count = _client().girder.get(
        "upenn_annotation/count", parameters=parameters
    )["count"]
    return {"count": count, "shape": shape, "tags": tags or []}


@mcp.tool(annotations=READ_ONLY)
@instrumented
def ni_annotations_summary(dataset_id: str, max_tags: int = 30) -> dict:
    """Summarize a dataset's annotations: total count, counts by tag (most
    common first, capped at max_tags), and counts by shape. Use this to
    learn which tags exist (e.g. "nucleus", "spot", "cell") before counting
    or filtering. An annotation with several tags counts once per tag.
    """
    # One server-side aggregation (POST upenn_annotation/summary): no
    # annotation rows reach this process. `shapes` arrives with the
    # annotation-summary-shapes branch; an older server omits it, and
    # by_shape is left out rather than paying a full scan per shape.
    summary = _client().girder.post(
        "upenn_annotation/summary",
        json={"datasetId": dataset_id, "filters": {}, "propertyPaths": []},
    )
    tags = summary["tags"]
    result = {
        "total": summary["total"],
        "by_tag": {t["tag"]: t["count"] for t in tags[:max(1, max_tags)]},
        "distinct_tags": len(tags),
    }
    if "shapes" in summary:
        result["by_shape"] = {
            entry["shape"]: entry["count"] for entry in summary["shapes"]
        }
    return result


def _slice_indexes(slice_setting: dict | None, current: int, size: int):
    """The indexes a layer reads on one axis, mirroring the frontend's
    resolveSlice / getLayerSliceIndexes: every index for max-merge, else
    one index; None when the layer resolves outside the axis (the app does
    not draw it then)."""
    kind = (slice_setting or {}).get("type", "current")
    value = (slice_setting or {}).get("value") or 0
    if size <= 1:
        return [0]
    if kind == "max-merge":
        return list(range(size))
    index = {"constant": value, "offset": current + value}.get(kind, current)
    return [index] if 0 <= index < size else None


def _encode_jpeg(rgb: np.ndarray) -> bytes:
    # JPEG, not PNG: noisy microscopy compresses badly losslessly (a 1024 px
    # PNG measured 1.1-1.2 MB in the spike; JPEG q85 is ~5x smaller).
    buf = io.BytesIO()
    PILImage.fromarray(rgb).save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@mcp.tool(annotations=READ_ONLY)
@instrumented
def ni_image_get_composite(
    dataset_id: str,
    xy: int = 0,
    z: int = 0,
    time: int = 0,
    max_size: int = DEFAULT_MAX_SIZE,
) -> Image:
    """Show the image: a color composite of the dataset's visible channels
    at one XY position, z-slice, and time point, rendered the way the user
    sees it in NimbusImage (their channel colors, contrast, and layer
    settings such as max projections). Returns a JPEG downsampled so its
    longer side is at most max_size pixels (default 1024, max 2048).
    """
    max_size = max(64, min(max_size, MAX_IMAGE_SIZE))
    ds = _client().dataset(dataset_id)
    sizes = {"xy": ds.num_xy, "z": ds.num_z, "time": ds.num_time}
    current = {"xy": xy, "z": z, "time": time}
    for axis, value in current.items():
        if not 0 <= value < sizes[axis]:
            raise ValueError(
                f"{axis}={value} is out of range (0..{sizes[axis] - 1})"
            )
    view, configuration = _view_and_configuration(dataset_id)
    overrides = view.get("layerContrasts") or {}
    images = ds.images
    images._ensure_frame_map()
    frame_map = images._frame_map
    gc = _client().girder

    # Spike: reimplements nimbusimage's get_composite, which fetches full
    # resolution and reads percentile contrast as quantiles (the app reads
    # it as a percent of the histogram's min..max). See RESULTS.md.
    composite = None
    for layer in configuration.get("layers", []):
        if not layer.get("visible", True):
            continue
        indexes = {
            axis: _slice_indexes(layer.get(axis), current[axis], sizes[axis])
            for axis in sizes
        }
        if any(v is None for v in indexes.values()):
            continue
        by_time = frame_map.get(layer.get("channel", 0), {})
        frames = [
            by_time[t][zi][xyi]
            for t in indexes["time"] for zi in indexes["z"]
            for xyi in indexes["xy"]
            if xyi in by_time.get(t, {}).get(zi, {})
        ]
        if not frames:
            continue  # channel absent at this location: the app skips it

        # Downsample on the server: large_image's region endpoint scales to
        # fit width x height, so full-resolution frames never cross the
        # wire. A max-merge layer is the per-pixel max over its frames.
        img = np.max([
            images._get_region(f, width=max_size, height=max_size).squeeze()
            for f in frames
        ], axis=0).astype(np.float64)

        contrast = overrides.get(layer.get("id")) or layer.get("contrast", {})
        black = contrast.get("blackPoint", 0)
        white = contrast.get("whitePoint", 100)
        if contrast.get("mode") == "absolute":
            cmin, cmax = float(black), float(white)
        else:
            # Percentile mode (the default): a linear percent of the
            # frames' histogram range, as in the frontend's toStyle().
            histograms = [
                gc.get(
                    f"item/{ds._item_id}/tiles/histogram",
                    parameters={**HISTOGRAM_PARAMS, "frame": f},
                )[0]
                for f in frames
            ]
            lo = min(h["min"] for h in histograms)
            hi = max(h["max"] for h in histograms)
            cmin = lo + black / 100 * (hi - lo)
            cmax = lo + white / 100 * (hi - lo)
        if cmax > cmin:
            img = (img - cmin) / (cmax - cmin)
        img = np.clip(img, 0.0, 1.0)
        r, g, b = _parse_color(layer.get("color", "white"))
        rgb = np.stack([img * r, img * g, img * b], axis=-1)
        composite = rgb if composite is None else np.maximum(composite, rgb)

    if composite is None:
        raise ValueError(
            "Nothing to show: no visible layer has an image at this "
            "location."
        )
    rgb8 = (np.clip(composite, 0.0, 1.0) * 255).astype(np.uint8)
    return Image(data=_encode_jpeg(rgb8), format="jpeg")


if __name__ == "__main__":
    if not os.environ.get("NI_API_KEY"):
        sys.exit("Set NI_API_KEY (and optionally NI_API_URL).")
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=int(os.environ.get("NI_MCP_PORT", "8000")),
        stateless_http=True,
    )
