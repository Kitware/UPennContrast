"""Workers (Docker analysis algorithms) and the jobs they run as."""

from __future__ import annotations

from typing import Literal

from mcp.server.mcpserver.exceptions import ToolError

import nimbusimage as ni

from nimbusimage_mcp import worker_values
from nimbusimage_mcp._common import (
    READ_ONLY,
    WRITES,
    client,
    instrumented,
    settings,
)

# Docker marker labels: present means true, whatever the value (often "").
ANNOTATION_LABEL = "isAnnotationWorker"
PROPERTY_LABEL = "isPropertyWorker"
MAX_DESCRIPTION = 200
MAX_TOOLTIP = 200
# How long ni_worker_interface waits for a worker to register its
# interface the first time it is asked.
INTERFACE_REQUEST_TIMEOUT = 60
LOG_TAIL = 1500


def worker_kind(labels: dict) -> str | None:
    if ANNOTATION_LABEL in labels:
        return "annotation"
    if PROPERTY_LABEL in labels:
        return "property"
    return None


def _trim(text, limit: int):
    if not isinstance(text, str) or len(text) <= limit:
        return text
    return text[:limit - 1] + "…"


@instrumented
def ni_workers_list(
    kind: Literal["annotation", "property", "all"] = "all",
    include_test_images: bool = False,
) -> dict:
    """List the analysis workers available on the server: annotation
    workers create objects or process images (e.g. Cellpose-SAM cell or
    nucleus segmentation, spot detection, image processing), property
    workers compute measurements (area, intensity). Returns image, name,
    kind, category, description, and for property workers the annotation
    shape they measure. Use ni_worker_interface to see a worker's
    parameters.
    """
    rows = []
    for image, labels in sorted(client().list_workers().items()):
        found = worker_kind(labels)
        if found is None or (kind != "all" and found != kind):
            continue
        if image.endswith(":test") and not include_test_images:
            continue
        row = {
            "image": image,
            "name": labels.get("interfaceName") or image,
            "kind": found,
            "category": labels.get("interfaceCategory"),
            "description": _trim(labels.get("description"), MAX_DESCRIPTION),
        }
        if found == "property":
            row["shape"] = labels.get("annotationShape")
        rows.append(row)
    return {"workers": rows}


def fetch_interface(nc: ni.NimbusClient, image: str) -> dict:
    """The worker's parameter interface, asking the worker to register it
    (a short job) the first time."""
    interface = nc.get_worker_interface(image, request_if_missing=False)
    if interface is None:
        response = nc.girder.post(
            "worker_interface/request", parameters={"image": image}
        )
        if isinstance(response, list) and response:
            try:
                ni.Job(nc.girder, response[0]).wait(
                    timeout=INTERFACE_REQUEST_TIMEOUT, verbose=False
                )
            except TimeoutError:
                raise ToolError(
                    f"{image} is still registering its parameters; try "
                    "again in a minute."
                ) from None
        interface = nc.get_worker_interface(image, request_if_missing=False)
    if not interface:
        raise ToolError(
            f"{image} has no parameter interface; check the image name "
            "with ni_workers_list."
        )
    return interface


@instrumented
def ni_worker_interface(image: str, dataset_id: str | None = None) -> dict:
    """The parameters a worker takes (from ni_workers_list): each one's
    name, type, default, min/max, and choices, plus value_formats saying
    the exact value shape each type expects. Pass dataset_id to also get
    that dataset's channel list (index and name), since channel
    parameters take 0-based channel indices. Call before ni_worker_run.
    """
    nc = client()
    interface = fetch_interface(nc, image)
    parameters, notes = [], []
    for name, element in sorted(
        interface.items(), key=lambda item: item[1].get("displayOrder", 0)
    ):
        if element.get("type") == "notes":
            notes.append(_trim(element.get("value"), MAX_TOOLTIP))
            continue
        row = {"name": name, "type": element.get("type")}
        for key in ("default", "min", "max", "step", "items", "unit",
                    "required"):
            if element.get(key) is not None:
                row[key] = element[key]
        if element.get("tooltip"):
            row["tooltip"] = _trim(element["tooltip"], MAX_TOOLTIP)
        parameters.append(row)
    result = {
        "image": image,
        "notes": notes,
        "parameters": parameters,
        "value_formats": {
            kind: worker_values.VALUE_FORMATS[kind]
            for kind in sorted({p["type"] for p in parameters})
            if kind in worker_values.VALUE_FORMATS
        },
    }
    if dataset_id:
        result["channels"] = [
            {"index": i, "name": name}
            for i, name in enumerate(nc.dataset(dataset_id).channels)
        ]
    return result


@instrumented
def ni_worker_run(
    dataset_id: str,
    image: str,
    parameters: dict | None = None,
    tags: list[str] | None = None,
    channel: int = 0,
    xy: int = 0,
    z: int = 0,
    time: int = 0,
) -> dict:
    """Run an annotation worker (e.g. Cellpose-SAM segmentation or spot
    detection, from ni_workers_list) on a dataset. It creates annotations
    tagged with `tags` (e.g. ["nucleus"]) and can take minutes. Returns a
    job_id at once; wait with ni_job_wait. `parameters` overrides the
    worker's parameters by name (see ni_worker_interface); the rest use
    their defaults. channel, xy, z, and time choose the image location;
    workers with "Batch XY/Z/Time" parameters process the ranges given
    there. To compute a measurement, use ni_property_compute instead.
    """
    nc = client()
    labels = nc.list_workers().get(image)
    if labels is None:
        raise ToolError(
            f"No worker image {image!r}; use ni_workers_list for names."
        )
    if worker_kind(labels) != "annotation":
        raise ToolError(
            f"{image} is not an annotation worker. Property workers run "
            "through a property: see ni_properties_list and "
            "ni_property_compute."
        )
    ds = nc.dataset(dataset_id)
    channels = ds.channels
    if not 0 <= channel < len(channels):
        raise ValueError(
            f"channel={channel} is out of range (0..{len(channels) - 1})"
        )
    values = worker_values.resolve(
        fetch_interface(nc, image), parameters or {}, channels
    )
    job = ds.annotations.compute(
        image=image,
        channel=channel,
        tags=tags or [],
        location=ni.Location(xy=xy, z=z, time=time),
        worker_interface=values,
        scales=ds.collections.scales,
        name=labels.get("interfaceName") or image,
    )
    return {"job_id": job.id, "status": job.status_name, "title": job.title}


@instrumented
def ni_job_wait(job_id: str, timeout_seconds: float = 60) -> dict:
    """Wait for a job started by ni_worker_run or ni_property_compute to
    finish, then report its status and the end of its log. Waits at most
    timeout_seconds (default 60, capped by the server, about 4 minutes);
    if the job is still going, the result says finished=false and you can
    call this again with the same job_id. Do not poll with other tools.
    """
    limit = max(1.0, min(timeout_seconds, settings().max_job_wait))
    job = client().job(job_id)
    try:
        job.wait(poll_interval=2.0, timeout=limit, verbose=False)
    except TimeoutError:
        pass
    return {
        "job_id": job.id,
        "title": job.title,
        "status": job.status_name,
        "finished": job.finished,
        "succeeded": job.succeeded,
        "log_tail": job.log[-LOG_TAIL:] if job.log else "",
    }


TOOLS = [
    (ni_workers_list, READ_ONLY),
    (ni_worker_interface, READ_ONLY),
    (ni_worker_run, WRITES),
    (ni_job_wait, READ_ONLY),
]
