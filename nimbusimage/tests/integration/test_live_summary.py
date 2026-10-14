"""Integration tests for ds.annotations.summary() against a live server."""

import pytest

import nimbusimage as ni

pytestmark = pytest.mark.integration


def _annotation(ds, shape, tags, x, channel=0):
    coordinates = [{"x": x, "y": 5.5}]
    if shape == "polygon":
        coordinates += [{"x": x + 4, "y": 5.5}, {"x": x + 4, "y": 9.5}]
    return ni.Annotation(
        id=None, shape=shape, tags=tags, channel=channel,
        location=ni.Location(), coordinates=coordinates, dataset_id=ds.id,
    )


@pytest.fixture
def populated(test_dataset):
    """Three cells (one also 'CD8+'), one 'region' polygon, two spots on
    channel 1, and an Area value on two of the cells."""
    ds = test_dataset
    created = ds.annotations.create_many([
        _annotation(ds, "polygon", ["cell"], 10),
        _annotation(ds, "polygon", ["cell", "CD8+"], 20),
        _annotation(ds, "polygon", ["cell"], 30),
        _annotation(ds, "polygon", ["region"], 40),
        _annotation(ds, "point", ["spot"], 50, channel=1),
        _annotation(ds, "point", ["spot"], 60, channel=1),
    ])
    prop = ds.properties.create(name="summary_test_area", shape="polygon")
    ds.properties.submit_values(prop.id, {
        created[0].id: {"Area": 5},
        created[1].id: {"Area": 15},
    })
    try:
        yield ds, prop
    finally:
        ds.properties.delete_values(prop.id)
        ds.properties.delete(prop.id)
        ds.annotations.delete_many([a.id for a in created])


class TestLiveSummary:
    def test_counts_by_tag_shape_and_channel(self, populated):
        ds, _ = populated
        s = ds.annotations.summary()
        assert s.total == 6
        assert s.tags == {"cell": 3, "spot": 2, "CD8+": 1, "region": 1}
        assert list(s.tags)[:2] == ["cell", "spot"]  # most common first
        assert s.shapes == {"polygon": 4, "point": 2}
        assert s.channels == {0: 4, 1: 2}

    def test_filters_narrow_the_summary(self, populated):
        ds, _ = populated
        # Any of the tags (the default), then exactly the tag set.
        assert ds.annotations.summary(tags=["spot", "region"]).total == 3
        exact = ds.annotations.summary(tags=["cell"], exclusive=True)
        assert exact.total == 2  # the CD8+ cell has another tag
        # A "+" in a tag survives the trip.
        assert ds.annotations.summary(tags=["CD8+"]).total == 1
        assert ds.annotations.summary(shape="point").shapes == {"point": 2}
        assert ds.annotations.summary(tags=["spot"]).channels == {1: 2}
        # An empty tag list is no tag filter.
        assert ds.annotations.summary(tags=[]).total == 6

    def test_property_statistics(self, populated):
        ds, prop = populated
        s = ds.annotations.summary(
            tags=["cell"], property_paths=[[prop.id, "Area"]],
        )
        [area] = s.properties
        assert area.path == [prop.id, "Area"]
        assert area.count == 2
        assert (area.mean, area.min, area.max) == (10, 5, 15)

    def test_empty_match_is_zero(self, populated):
        ds, _ = populated
        s = ds.annotations.summary(tags=["no-such-tag"])
        assert (s.total, s.tags, s.shapes, s.channels) == (0, {}, {}, {})
