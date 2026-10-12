"""Tool logic with a mocked nimbusimage client: shapes, caps, errors."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import girder_client
import numpy as np
import pytest
from mcp.server.mcpserver import Image
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.mcpserver.utilities.func_metadata import func_metadata

import nimbusimage as ni
from nimbusimage_mcp import _common
from nimbusimage_mcp.server import build_server
from nimbusimage_mcp.tools import annotations, datasets, help, images, \
    properties, workers
from nimbusimage_mcp.tools import TOOLS

from conftest import make_settings


def http_error(status: int, message: str = "") -> girder_client.HttpError:
    return girder_client.HttpError(
        status, json.dumps({"message": message}), "http://g", "GET"
    )


def annotation(i: int, tags=("cell",), shape="polygon") -> ni.Annotation:
    return ni.Annotation(
        _id=f"a{i}", shape=shape, tags=list(tags),
        coordinates=[{"x": 0, "y": 0}, {"x": 2, "y": 4}],
    )


def run_tool(tool, **kwargs):
    """Call an async tool from a sync test."""
    return asyncio.run(tool(**kwargs))


def loads(text: str):
    assert isinstance(text, str)
    return json.loads(text)


# --- plumbing -----------------------------------------------------------


def test_result_size_matches_sdk_wire_format():
    meta = func_metadata(lambda: None, structured_output=False)
    text = _common.compact({"total": 3, "datasets": [{"id": "a"}]})
    wire = meta.convert_result(text)
    assert wire.structured_content is None
    assert wire.content[0].text == text
    assert _common.result_size(text) == len(text.encode())
    # Compact, unlike the SDK's indent=2 default for dicts.
    assert "\n" not in text and ": " not in text
    # Images travel base64-encoded.
    assert _common.result_size(Image(data=b"x" * 10, format="jpeg")) == 16


def test_every_tool_is_registered_with_its_annotations():
    server = build_server(make_settings())
    listed = {t.name: t for t in asyncio.run(server.list_tools())}
    assert set(listed) == {fn.__name__ for fn, _ in TOOLS}
    writers = {name for name, t in listed.items()
               if t.annotations and t.annotations.destructive_hint}
    assert writers == {"ni_annotations_tag", "ni_worker_run",
                       "ni_property_compute"}
    for name, tool in listed.items():
        assert tool.output_schema is None, name
        if name not in writers | {"ni_worker_interface"}:
            assert tool.annotations.read_only_hint, name
    # Registering a worker's interface writes server state (a job).
    assert listed["ni_worker_interface"].annotations.read_only_hint is False


@pytest.mark.parametrize("status, fragment", [
    (401, "scope"), (403, "denied"), (400, "No such folder"),
    (404, "Not found"), (500, "server error"),
])
def test_girder_errors_become_tool_errors(nc, status, fragment):
    nc.dataset.side_effect = http_error(status, "No such folder")
    with pytest.raises(ToolError, match=fragment):
        datasets.ni_dataset_info(dataset_id="x")


def test_known_scale_drops_placeholders():
    assert datasets.known_scale({"value": 1, "unit": "m"}) is None
    assert datasets.known_scale({"value": 0, "unit": "mm"}) is None
    assert datasets.known_scale({"value": None, "unit": "mm"}) is None
    assert datasets.known_scale(None) is None
    real = {"value": 10, "unit": "µm"}
    assert datasets.known_scale(real) == real


def test_round_sig():
    assert _common.round_sig(1234.5678) == 1235.0
    assert _common.round_sig(0.000123456) == 0.0001235
    assert _common.round_sig(None) is None
    assert _common.round_sig(0) == 0


# --- caps ---------------------------------------------------------------


def test_list_tools_enforce_cap(nc):
    folders = [{"_id": f"d{i}", "name": f"ds {i}"} for i in range(150)]
    nc.list_datasets.return_value = folders
    result = loads(datasets.ni_datasets_list(limit=1000))
    assert result["returned"] == datasets.MAX_DATASETS == 100
    assert result["total"] == 150

    accessor = nc.dataset.return_value.annotations
    accessor.count.return_value = 5000
    accessor.list.return_value = [annotation(i) for i in range(200)]
    result = loads(annotations.ni_annotations_list(
        dataset_id="d", limit=10_000, offset=-5
    ))
    kwargs = accessor.list.call_args.kwargs
    assert kwargs["limit"] == annotations.MAX_LIST == 200
    assert kwargs["offset"] == 0
    assert result["total_matching"] == 5000
    assert result["has_more"] and result["next_offset"] == 200


def test_annotation_rows_are_small(nc):
    accessor = nc.dataset.return_value.annotations
    accessor.count.return_value = 1
    accessor.list.return_value = [annotation(1)]
    row, = loads(annotations.ni_annotations_list(dataset_id="d"))[
        "annotations"]
    assert row == {
        "id": "a1", "shape": "polygon", "tags": ["cell"], "channel": 0,
        "location": {"XY": 0, "Z": 0, "Time": 0}, "center": [1.0, 2.0],
        "vertices": 2,
    }


def test_composite_downsampled(nc):
    ds = nc.dataset.return_value
    ds.num_xy, ds.num_z, ds.num_time = 1, 1, 1
    ds.shape = (4000, 3000)
    ds.collections.layers = [{"visible": True}]
    ds.images.get_composite.return_value = np.full((8, 8, 3), 9, np.uint8)
    result = images.ni_image_get_composite(
        dataset_id="d", max_size=99_999, crop=(-10, 0, 5000, 100)
    )
    kwargs = ds.images.get_composite.call_args.kwargs
    assert kwargs["max_size"] == images.MAX_IMAGE_SIZE
    assert kwargs["crop"] == (0, 0, 3000, 100)
    assert isinstance(result, Image)
    # An all-black composite is still shown, with a note saying why it
    # may be black.
    ds.images.get_composite.return_value = np.zeros((8, 8, 3), np.uint8)
    image, note = images.ni_image_get_composite(dataset_id="d")
    assert isinstance(image, Image) and note == images.BLACK_NOTE
    assert _common.result_size([image, note]) == (
        _common.result_size(image) + len(note))


def test_channel_view_is_one_stretched_channel(nc):
    ds = nc.dataset.return_value
    ds.num_xy, ds.num_z, ds.num_time, ds.num_channels = 1, 3, 1, 2
    frame = np.arange(10_000, dtype=np.uint16).reshape(100, 100)
    ds.images.get.return_value = frame
    images.ni_image_get_channel(dataset_id="d", channel=1, z=2, max_size=5)
    kwargs = ds.images.get.call_args.kwargs
    assert kwargs["channel"] == 1 and kwargs["z"] == 2
    assert kwargs["max_size"] == 64
    stretched = images.stretch(frame)
    assert stretched.dtype == np.uint8
    assert stretched.min() == 0 and stretched.max() == 255
    with pytest.raises(ToolError, match="channel=2 is out of range"):
        images.ni_image_get_channel(dataset_id="d", channel=2)


def test_check_crop_clips_and_rejects_empty():
    assert images.check_crop((-5, 10, 120, 50), 100, 80) == (0, 10, 100, 50)
    for bad in ((50, 0, 40, 10), (0, 0, 10, 0), (200, 0, 300, 10)):
        with pytest.raises(ValueError, match="empty or outside"):
            images.check_crop(bad, 100, 80)


# --- annotations --------------------------------------------------------


def test_count_across_datasets_reports_each(nc):
    def dataset(dataset_id):
        ds = SimpleNamespace(annotations=SimpleNamespace())
        if dataset_id == "bad":
            def fail(**_):
                raise http_error(403)
            ds.annotations.count = fail
        else:
            ds.annotations.count = lambda **_: len(dataset_id)
        return ds

    nc.dataset.side_effect = dataset
    result = loads(annotations.ni_annotations_count(
        dataset_ids=["aa", "bad", "aaa", "aa"], shape="point"
    ))
    assert result["total"] == 5 and result["incomplete"] is True
    assert [c["dataset_id"] for c in result["counts"]] == ["aa", "bad", "aaa"]
    assert "denied" in result["counts"][1]["error"]
    with pytest.raises(ToolError, match="between 1 and 50"):
        annotations.ni_annotations_count(dataset_ids=["x"] * 51)


@pytest.mark.parametrize("mode, expected", [
    ("add", ["a", "b", "c"]),
    ("remove", ["a"]),
    ("replace", ["b", "c"]),
])
def test_retag_modes(mode, expected):
    assert annotations.retag(["a", "b"], ["b", "c", "c"], mode) == expected


def test_tag_by_query_updates_only_changed(nc):
    accessor = nc.dataset.return_value.annotations
    accessor.count.return_value = 2
    accessor.list.return_value = [
        annotation(1, tags=["cell"]), annotation(2, tags=["cell", "big"]),
    ]
    result = loads(annotations.ni_annotations_tag(
        dataset_id="d", tags=["big"], mode="add", match_tags=["cell"]
    ))
    assert result["matched"] == 2 and result["changed"] == 1
    accessor.update_many.assert_called_once_with(
        [("a1", {"tags": ["cell", "big"]})]
    )
    accessor.update_many.reset_mock()
    accessor.list.return_value = [annotation(3, tags=["big", "cell"])]
    accessor.count.return_value = 1
    result = loads(annotations.ni_annotations_tag(
        dataset_id="d", tags=["cell", "big"], mode="replace",
        match_tags=["cell"],
    ))
    assert result["changed"] == 0
    accessor.update_many.assert_not_called()


def test_tag_by_ids(nc):
    accessor = nc.dataset.return_value.annotations
    accessor.get_many.return_value = [annotation(1, tags=["cell", "x"])]
    result = loads(annotations.ni_annotations_tag(
        dataset_id="d", tags=["x"], mode="remove", annotation_ids=["a1"]
    ))
    accessor.get_many.assert_called_once_with(["a1"])
    accessor.count.assert_not_called()
    accessor.update_many.assert_called_once_with([("a1", {"tags": ["cell"]})])
    assert result["changed"] == 1


def test_tag_refuses_unbounded_or_ambiguous_targets(nc):
    accessor = nc.dataset.return_value.annotations
    with pytest.raises(ToolError, match="match_shape, match_tags"):
        annotations.ni_annotations_tag(dataset_id="d", tags=["x"],
                                       mode="add")
    with pytest.raises(ToolError, match="not both"):
        annotations.ni_annotations_tag(
            dataset_id="d", tags=["x"], mode="add", annotation_ids=["a"],
            match_shape="point",
        )
    with pytest.raises(ToolError, match="non-empty"):
        annotations.ni_annotations_tag(dataset_id="d", tags=[], mode="add",
                                       match_shape="point")
    accessor.count.return_value = annotations.MAX_TAG_ANNOTATIONS + 1
    with pytest.raises(ToolError, match="Narrow it"):
        annotations.ni_annotations_tag(dataset_id="d", tags=["x"],
                                       mode="add", match_shape="point")
    with pytest.raises(ToolError, match="At most"):
        annotations.ni_annotations_tag(
            dataset_id="d", tags=["x"], mode="add",
            annotation_ids=["a"] * (annotations.MAX_TAG_ANNOTATIONS + 1),
        )
    # An empty id list is "no target", never "every annotation".
    with pytest.raises(ToolError, match="match_shape, match_tags"):
        annotations.ni_annotations_tag(dataset_id="d", tags=["x"],
                                       mode="add", annotation_ids=[])
    accessor.update_many.assert_not_called()
    accessor.list.assert_not_called()
    accessor.get_many.assert_not_called()


# --- properties ---------------------------------------------------------


def _property(pid, name="Blob metrics"):
    return ni.Property(_id=pid, name=name, shape="polygon",
                       image="properties/blob_metrics:latest",
                       tags={"tags": ["nucleus"], "exclusive": False})


def _value_docs(nc, docs):
    nc.girder.get.return_value = docs


def test_properties_list_is_scoped_to_the_configuration(nc):
    ds = nc.dataset.return_value
    ds.collections.property_ids = ["p2", "p1"]
    ds.properties.list.return_value = [
        _property("p1"), _property("p2", "Intensity"), _property("other"),
    ]
    _value_docs(nc, [{"values": {
        "p1": {"Area": 1, "Centroid": {"x": 1, "y": 2}},
        "ghost": {"Area": 3},
    }}])
    nc.girder.post.return_value = {"p1": 0, "p2": 7}
    rows = loads(properties.ni_properties_list(dataset_id="d"))["properties"]
    assert [r["id"] for r in rows] == ["p2", "p1"]
    assert rows[1]["value_paths"] == [
        ["p1", "Area"], ["p1", "Centroid", "x"], ["p1", "Centroid", "y"],
    ]
    assert rows[0]["value_paths"] == [] and rows[0]["uncomputed"] == 7
    # Both ends of the value collection are sampled.
    sortdirs = [c.kwargs["parameters"]["sortdir"]
                for c in nc.girder.get.call_args_list]
    assert sortdirs == [1, -1]


def test_values_summary_summarizes_discovered_paths(nc):
    ds = nc.dataset.return_value
    ds.collections.property_ids = ["p1"]
    ds.properties.list.return_value = [_property("p1")]
    _value_docs(nc, [{"values": {"p1": {"Area": 1, "Perimeter": 2}}}])
    ds.annotations.summary.return_value = ni.AnnotationSummary(
        total=10, tags={}, properties=[
            ni.PropertyStats(path=["p1", "Area"], count=10, mean=1.23456,
                             std=None, min=0.5, max=2),
        ],
    )
    result = loads(properties.ni_property_values_summary(
        dataset_id="d", tags=["nucleus"]
    ))
    kwargs = ds.annotations.summary.call_args.kwargs
    assert kwargs["property_paths"] == [["p1", "Area"], ["p1", "Perimeter"]]
    assert kwargs["tags"] == ["nucleus"]
    stat, = result["stats"]
    assert stat["property"] == "Blob metrics" and stat["path"] == "Area"
    assert stat["mean"] == 1.235


def test_values_summary_says_when_nothing_is_computed(nc):
    ds = nc.dataset.return_value
    ds.collections.property_ids = ["p1"]
    ds.properties.list.return_value = [_property("p1")]
    _value_docs(nc, [])
    with pytest.raises(ToolError, match="ni_property_compute"):
        properties.ni_property_values_summary(dataset_id="d")
    with pytest.raises(ToolError, match="ni_properties_list"):
        properties.ni_property_values_summary(dataset_id="d",
                                              property_id="nope")


def test_histogram_validates_the_path(nc):
    for bad in (["p1"], ["p1", "a.b"], ["p1", ""], ["p1", "$bad"]):
        with pytest.raises(ToolError, match="property_path"):
            properties.ni_property_histogram(dataset_id="d",
                                             property_path=bad)
    hist = nc.dataset.return_value.properties.histogram
    hist.return_value = [{"min": 1, "max": 2, "count": 3}]
    result = loads(properties.ni_property_histogram(
        dataset_id="d", property_path=["p1", "Area"], buckets=500
    ))
    hist.assert_called_once_with("p1.Area", buckets=properties.MAX_BUCKETS)
    assert result["total"] == 3


def test_property_compute_needs_a_configured_property(nc):
    ds = nc.dataset.return_value
    ds.collections.property_ids = ["p1"]
    with pytest.raises(ToolError, match="ni_properties_list"):
        properties.ni_property_compute(dataset_id="d", property_id="p9")
    ds.properties.compute.return_value = SimpleNamespace(
        id="j1", status_name="queued", title="Blob metrics"
    )
    assert loads(properties.ni_property_compute(
        dataset_id="d", property_id="p1"
    ))["job_id"] == "j1"


# --- workers ------------------------------------------------------------


SEG = "annotations/seg:latest"
WORKERS = {
    "annotations/seg:latest": {"isAnnotationWorker": "",
                               "interfaceName": "Seg"},
    "annotations/seg:test": {"isAnnotationWorker": ""},
    "properties/area:latest": {"isPropertyWorker": "",
                               "annotationShape": "polygon"},
    "nimbusimage/worker-base:latest": {"isUPennContrastWorkerBase": "True"},
}


def test_workers_list_keeps_real_workers(nc):
    nc.list_workers.return_value = WORKERS
    rows = loads(workers.ni_workers_list())["workers"]
    assert [r["image"] for r in rows] == [
        "annotations/seg:latest", "properties/area:latest",
    ]
    assert rows[1]["shape"] == "polygon"
    rows = loads(workers.ni_workers_list(kind="annotation",
                                         include_test_images=True))["workers"]
    assert [r["image"] for r in rows] == [
        "annotations/seg:latest", "annotations/seg:test",
    ]


INTERFACE = {
    "Model": {"type": "select", "items": ["a", "b"], "default": "a",
              "displayOrder": 2},
    "Slot 1": {"type": "channelCheckboxes", "displayOrder": 1},
    "About": {"type": "notes", "value": "Segments cells.", "displayOrder": 0},
}


def test_worker_interface_registers_only_installed_workers(nc):
    nc.get_worker_interface.return_value = None
    nc.list_workers.return_value = WORKERS
    for image in ("evil/image:latest", "nimbusimage/worker-base:latest"):
        with pytest.raises(ToolError, match="No worker image"):
            run_tool(workers.ni_worker_interface, image=image)
    nc.girder.post.assert_not_called()


def test_worker_interface_shape(nc):
    nc.get_worker_interface.return_value = INTERFACE
    nc.dataset.return_value.channels = ["DAPI", "GFP"]
    nc.dataset.return_value.num_channels = 2
    result = loads(run_tool(
        workers.ni_worker_interface, image=SEG, dataset_id="d"
    ))
    assert result["notes"] == ["Segments cells."]
    assert [p["name"] for p in result["parameters"]] == ["Slot 1", "Model"]
    assert set(result["value_formats"]) == {"channelCheckboxes", "select"}
    assert result["channels"][1] == {"index": 1, "name": "GFP"}


def test_worker_run_fills_defaults_and_rejects_property_workers(nc):
    nc.list_workers.return_value = WORKERS
    nc.get_worker_interface.return_value = INTERFACE
    ds = nc.dataset.return_value
    ds.channels, ds.num_channels = ["DAPI", "GFP"], 2
    ds.num_xy, ds.num_z, ds.num_time = 1, 5, 1
    ds.annotations.compute.return_value = SimpleNamespace(
        id="j1", status_name="queued", title="Seg"
    )
    result = loads(run_tool(
        workers.ni_worker_run, dataset_id="d", image=SEG,
        parameters={"Slot 1": ["gfp"]}, tags=["cell"], z=3,
    ))
    assert result["job_id"] == "j1"
    kwargs = ds.annotations.compute.call_args.kwargs
    assert kwargs["worker_interface"] == {
        "Model": "a", "Slot 1": {"0": False, "1": True}, "About": "",
    }
    assert kwargs["location"] == ni.Location(xy=0, z=3, time=0)
    assert kwargs["tags"] == ["cell"]
    with pytest.raises(ToolError, match="not an annotation worker"):
        run_tool(workers.ni_worker_run, dataset_id="d",
                 image="properties/area:latest")
    with pytest.raises(ToolError, match="Unknown worker parameters"):
        run_tool(workers.ni_worker_run, dataset_id="d", image=SEG,
                 parameters={"Nope": 1})


def test_worker_tools_count_unnamed_channels(nc):
    """large_image leaves `channels` empty for images without channel
    names (e.g. one frame); num_channels still counts them."""
    nc.list_workers.return_value = WORKERS
    nc.get_worker_interface.return_value = {
        "Slot 1": {"type": "channelCheckboxes"}}
    ds = nc.dataset.return_value
    ds.channels, ds.num_channels = [], 1
    ds.num_xy, ds.num_z, ds.num_time = 1, 1, 1
    ds.annotations.compute.return_value = SimpleNamespace(
        id="j1", status_name="queued", title="Seg")
    run_tool(workers.ni_worker_run, dataset_id="d", image=SEG,
             parameters={"Slot 1": [0]})
    assert ds.annotations.compute.call_args.kwargs["worker_interface"] == {
        "Slot 1": {"0": True}}
    info = loads(run_tool(workers.ni_worker_interface, image=SEG,
                          dataset_id="d"))
    assert info["channels"] == [{"index": 0, "name": None}]


def test_worker_run_checks_the_location_before_submitting(nc):
    nc.list_workers.return_value = WORKERS
    nc.get_worker_interface.return_value = INTERFACE
    ds = nc.dataset.return_value
    ds.channels, ds.num_channels = ["DAPI"], 1
    ds.num_xy, ds.num_z, ds.num_time = 1, 3, 1
    with pytest.raises(ToolError, match="z=3 is out of range"):
        run_tool(workers.ni_worker_run, dataset_id="d", image=SEG, z=3)
    ds.annotations.compute.assert_not_called()


class _Job:
    """Finishes after `polls` refreshes (never, for None)."""

    def __init__(self, polls, clock=None):
        self.id, self.title = "j1", "Seg"
        self.polls_left = polls
        self.refreshes = 0
        self.refreshed_at = []
        self.clock = clock or {"now": 0.0}
        self.log = "x" * 5000

    @property
    def finished(self):
        return self.polls_left is not None and self.refreshes > \
            self.polls_left

    succeeded = finished

    @property
    def status_name(self):
        return "success" if self.finished else "running"

    def refresh(self):
        self.refreshes += 1
        self.refreshed_at.append(self.clock["now"])


def test_job_wait_clamps_and_reports_still_running(nc, monkeypatch):
    clock = {"now": 0.0}
    sleeps = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)
        clock["now"] += seconds

    monkeypatch.setattr(workers.anyio, "sleep", fake_sleep)
    monkeypatch.setattr(workers.time, "monotonic", lambda: clock["now"])
    job = _Job(polls=None, clock=clock)
    nc.job.return_value = job
    result = loads(asyncio.run(workers.ni_job_wait(
        job_id="j1", timeout_seconds=10_000
    )))
    # Waits close to the cap, and no poll starts at or after it.
    limit = _common.settings().max_job_wait
    assert limit - workers.POLL_SECONDS <= sum(sleeps) < limit
    assert max(job.refreshed_at) < limit
    assert result["finished"] is False and result["status"] == "running"
    assert len(result["log_tail"]) == workers.LOG_TAIL

    clock["now"], sleeps[:] = 0.0, []
    nc.job.return_value = _Job(polls=2)
    result = loads(asyncio.run(workers.ni_job_wait(job_id="j1")))
    assert result["succeeded"] is True
    assert sleeps == [workers.POLL_SECONDS] * 2


def test_job_wait_scope_problem_is_explained(nc):
    nc.job.return_value.refresh.side_effect = PermissionError(
        "core.user_auth")
    with pytest.raises(ToolError, match="core.user_auth"):
        asyncio.run(workers.ni_job_wait(job_id="j1"))


# --- help ---------------------------------------------------------------


def test_help_topic(nc):
    assert "workflows" in loads(help.ni_help_topic())["topics"]
    nc.girder.get.return_value = {"topic": "workflows", "markdown": "# Hi"}
    assert loads(help.ni_help_topic(topic="workflows"))["markdown"] == "# Hi"
    nc.girder.get.side_effect = http_error(
        400, "Unknown help topic. Available: a, b"
    )
    with pytest.raises(ToolError, match="Available: a, b"):
        help.ni_help_topic(topic="nope")
