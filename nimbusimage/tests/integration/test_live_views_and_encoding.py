"""Integration tests for free-text query encoding, the caller's view and
configuration settings, and the batched dataset listing."""

import pytest

import nimbusimage as ni

pytestmark = pytest.mark.integration


def _point(ds, tags):
    return ni.Annotation(
        id=None, shape="point", tags=tags,
        channel=0, location=ni.Location(),
        coordinates=[{"x": 5.5, "y": 5.5}],
        dataset_id=ds.id,
    )


class TestLiveTagEncoding:
    def test_tags_with_special_characters_round_trip(self, test_dataset):
        """"+" must not arrive as a space, and "&" must not split the
        query: each tag matches only its own annotation."""
        ds = test_dataset
        # Different counts, so "CD8+" read as "CD8 " cannot pass.
        created = ds.annotations.create_many([
            _point(ds, ["CD8+"]),
            _point(ds, ["CD8 "]),
            _point(ds, ["CD8 "]),
            _point(ds, ["a&b"]),
        ])
        try:
            assert ds.annotations.count(tags=["CD8+"]) == 1
            assert ds.annotations.count(tags=["CD8 "]) == 2
            [listed] = ds.annotations.list(tags=["a&b"])
            assert listed.tags == ["a&b"]
        finally:
            ds.annotations.delete_many([a.id for a in created])


class TestLiveViewAndConfiguration:
    def test_default_view_is_the_callers_own(self, test_dataset):
        view = test_dataset.collections.default_view()
        assert view is not None
        assert view["datasetId"] == test_dataset.id

    def test_pixel_size_and_overrides_follow_the_app(
        self, client, test_dataset,
    ):
        """Configuration scales give the pixel size (a dataset with no
        image calibration, like a Xenium morphology image); the view's
        scales and contrast overrides take precedence, as in the app."""
        gc = client.girder
        ds = test_dataset
        view = ds.collections.default_view()
        gc.put(
            f"upenn_collection/{view['configurationId']}/metadata",
            json={"scales": {"pixelSize": {"value": 0.2125, "unit": "µm"}}},
        )
        ds.collections.refresh()
        assert ds.pixel_size == ni.PixelSize(value=0.2125, unit="um")

        override = {"mode": "percentile", "blackPoint": 0, "whitePoint": 17}
        gc.put(f"dataset_view/{view['_id']}", json={
            **{k: view[k] for k in ("datasetId", "configurationId")},
            "lastLocation": view.get("lastLocation", {}),
            "layerContrasts": {"layer_1": override},
            "scales": {"pixelSize": {"value": 0.5, "unit": "µm"}},
        })
        ds.collections.refresh()
        assert ds.collections.layer_contrasts == {"layer_1": override}
        assert ds.pixel_size.value == 0.5


class TestLiveListDatasets:
    def test_batched_listing_matches_per_folder_lookups(
        self, client, test_dataset,
    ):
        """The single resource/batch lookup returns exactly the readable
        folders, in view order, that one GET per folder would."""
        gc = client.girder
        datasets = client.list_datasets()
        assert test_dataset.id in [d["_id"] for d in datasets]

        views = gc.get("dataset_view", parameters={"limit": 0})
        ids = list(dict.fromkeys(
            v["datasetId"] for v in views if v.get("datasetId")
        ))
        one_by_one = client._readable_folders_one_by_one(ids)
        assert [d["_id"] for d in datasets] == [f["_id"] for f in one_by_one]
