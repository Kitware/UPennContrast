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

MAX_DATASETS = 200
DEFAULT_MAX_SIZE = 1024
MAX_IMAGE_SIZE = 2048

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
    pixel size (µm), z step, and bit depth; either is null when unknown.
    Use this before fetching images.
    """
    ds = _client().dataset(dataset_id)
    height, width = ds.shape
    pixel = ds.pixel_size  # the app's scales; None when unknown
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
        # One unit for every dataset (files calibrate in mm, configurations
        # often in µm), so sizes compare without per-dataset conversion.
        "pixel_size_um": pixel.to("um").value if pixel else None,
        "z_step": _known_scale(ds.collections.scales.get("zStep")),
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
    count = _client().dataset(dataset_id).annotations.count(
        shape=shape, tags=tags
    )
    return {"count": count, "shape": shape, "tags": tags or []}


@mcp.tool(annotations=READ_ONLY)
@instrumented
def ni_annotations_summary(dataset_id: str, max_tags: int = 30) -> dict:
    """Summarize a dataset's annotations: total count, counts by tag (most
    common first, capped at max_tags), and counts by shape. Use this to
    learn which tags exist (e.g. "nucleus", "spot", "cell") before counting
    or filtering. An annotation with several tags counts once per tag.
    """
    # One server-side aggregation; no annotation rows reach this process.
    summary = _client().dataset(dataset_id).annotations.summary()
    return {
        "total": summary.total,
        "by_tag": dict(list(summary.tags.items())[:max(1, max_tags)]),
        "distinct_tags": len(summary.tags),
        "by_shape": summary.shapes,
    }


# exampleConfigurationBase().scales in src/store/model.ts: the app's
# placeholder for a scale nobody set.
_PLACEHOLDER_SCALE = {"value": 1, "unit": "m"}


def _known_scale(scale: dict | None) -> dict | None:
    """A configured scale, or None for the app's placeholder or a
    non-positive value (an uncalibrated file)."""
    if not scale or scale == _PLACEHOLDER_SCALE:
        return None
    value = scale.get("value")
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    return scale


def _check_crop(crop, width: int, height: int) -> tuple[int, int, int, int]:
    """The crop, clipped to the image; ValueError (shown to the model)
    when it is empty or entirely outside the image."""
    left, top, right, bottom = crop
    left, right = max(0, left), min(width, right)
    top, bottom = max(0, top), min(height, bottom)
    if right <= left or bottom <= top:
        raise ValueError(
            f"crop {tuple(crop)} is empty or outside the image "
            f"(width {width}, height {height}); use "
            "left < right and top < bottom within those bounds."
        )
    return left, top, right, bottom


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
    crop: tuple[int, int, int, int] | None = None,
) -> Image:
    """Show the image: a color composite of the dataset's visible channels
    at one XY position, z-slice, and time point, rendered the way the user
    sees it in NimbusImage (their channel colors, contrast, and layer
    settings such as max projections). Returns a JPEG whose longer side is
    at most max_size pixels (default 1024, max 2048). To zoom in, pass
    crop=(left, top, right, bottom) in full-resolution image pixels (see
    width/height from ni_dataset_info).
    """
    max_size = max(64, min(max_size, MAX_IMAGE_SIZE))
    ds = _client().dataset(dataset_id)
    sizes = {"xy": ds.num_xy, "z": ds.num_z, "time": ds.num_time}
    for axis, value in {"xy": xy, "z": z, "time": time}.items():
        if not 0 <= value < sizes[axis]:
            raise ValueError(
                f"{axis}={value} is out of range (0..{sizes[axis] - 1})"
            )
    if crop is not None:
        height, width = ds.shape
        crop = _check_crop(crop, width, height)
    if not any(layer.get("visible", True) for layer in ds.collections.layers):
        raise ValueError("This dataset has no visible layers to show.")
    rgb = ds.images.get_composite(
        xy=xy, z=z, time=time, dtype="uint8", max_size=max_size, crop=crop
    )
    if not rgb.any():
        # get_composite returns black when no layer draws here (e.g. an
        # offset slice out of range); say so rather than show a black image.
        raise ValueError(
            "Nothing is drawn at this location: every visible layer is "
            "empty or not shown at this xy/z/time."
        )
    return Image(data=_encode_jpeg(rgb), format="jpeg")


if __name__ == "__main__":
    if not os.environ.get("NI_API_KEY"):
        sys.exit("Set NI_API_KEY (and optionally NI_API_URL).")
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=int(os.environ.get("NI_MCP_PORT", "8000")),
        stateless_http=True,
    )
