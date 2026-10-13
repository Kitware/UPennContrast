"""Tests for AnnotationAccessor."""

import pytest

from nimbusimage.annotations import AnnotationAccessor
from nimbusimage.models import Annotation, Location


class TestAnnotationListAfterId:
    """NIM-002: list() can take a stable _id cursor via after_id."""

    def test_list_passes_after_id(self, mock_gc):
        mock_gc.get.return_value = []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        accessor.list(after_id="ann_042")
        call_url = mock_gc.get.call_args[0][0]
        assert "afterId=ann_042" in call_url

    def test_list_omits_after_id_when_none(self, mock_gc):
        mock_gc.get.return_value = []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        accessor.list()
        call_url = mock_gc.get.call_args[0][0]
        assert "afterId" not in call_url

    def test_list_passes_sort(self, mock_gc):
        mock_gc.get.return_value = []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        accessor.list(sort="_id", sortdir=1)
        call_url = mock_gc.get.call_args[0][0]
        assert "sort=_id" in call_url
        assert "sortdir=1" in call_url

    def test_list_omits_sort_by_default(self, mock_gc):
        mock_gc.get.return_value = []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        accessor.list()
        call_url = mock_gc.get.call_args[0][0]
        assert "sort=" not in call_url


class TestAnnotationIterAll:
    """NIM-002: iter_all() walks the stable afterId cursor.

    Unlike offset pagination, the afterId cursor is mutation-safe: it
    always advances past the largest _id already seen, so deleting
    records as you iterate never skips any.
    """

    def test_iter_all_walks_after_id(self, mock_gc):
        page1 = [{"_id": "a1", "shape": "point"},
                 {"_id": "a2", "shape": "point"}]
        page2 = [{"_id": "a3", "shape": "point"}]
        page3 = []
        mock_gc.get.side_effect = [page1, page2, page3]
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        results = list(accessor.iter_all(page_size=2))
        assert [a.id for a in results] == ["a1", "a2", "a3"]

        urls = [c[0][0] for c in mock_gc.get.call_args_list]
        assert len(urls) == 3
        # First request has no cursor; later ones advance past last _id.
        assert "afterId" not in urls[0]
        assert "limit=2" in urls[0]
        assert "afterId=a2" in urls[1]
        assert "afterId=a3" in urls[2]

    def test_iter_all_requests_id_sort_every_page(self, mock_gc):
        """The afterId cursor is only correct if the server sorts by _id,
        so iter_all must force sort=_id&sortdir=1 on every request — the
        backend otherwise defaults to lowerName."""
        mock_gc.get.side_effect = [
            [{"_id": "a1", "shape": "point"}],
            [],
        ]
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        list(accessor.iter_all(page_size=1))
        for call in mock_gc.get.call_args_list:
            url = call[0][0]
            assert "sort=_id" in url
            assert "sortdir=1" in url

    def test_iter_all_correct_when_backend_unsorted(self, mock_gc):
        """If the server only returns _id-ordered pages when sort=_id is
        requested (and scrambled order otherwise), iter_all must still yield
        every record once — proving it relies on the sort param, not luck."""
        ordered = ["a1", "a2", "a3", "a4", "a5"]
        scrambled = ["a3", "a1", "a5", "a2", "a4"]

        def fake_get(url):
            after = None
            if "afterId=" in url:
                after = url.split("afterId=", 1)[1].split("&", 1)[0]
            limit = int(url.split("limit=", 1)[1].split("&", 1)[0])
            source = ordered if "sort=_id" in url else scrambled
            pool = [i for i in source if after is None or i > after]
            return [{"_id": i, "shape": "point"} for i in pool[:limit]]

        mock_gc.get.side_effect = fake_get
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        seen = [a.id for a in accessor.iter_all(page_size=2)]
        assert sorted(seen) == ordered
        assert seen == sorted(seen)

    def test_iter_all_raises_if_page_item_has_no_id(self, mock_gc):
        """A missing _id would otherwise drop the cursor and infinite-loop."""
        mock_gc.get.return_value = [{"shape": "point"}]  # no _id
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        with pytest.raises(RuntimeError, match="_id"):
            list(accessor.iter_all(page_size=2))

    def test_iter_all_passes_filters(self, mock_gc):
        mock_gc.get.side_effect = [[{"_id": "a1", "shape": "polygon"}], []]
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        list(accessor.iter_all(shape="polygon", tags=["nucleus"]))
        first_url = mock_gc.get.call_args_list[0][0][0]
        assert "shape=polygon" in first_url
        assert "nucleus" in first_url

    def test_iter_all_safe_during_deletion(self, mock_gc):
        """Delete-as-you-go must not skip records (the NIM-002 bug)."""
        store = ["a1", "a2", "a3", "a4", "a5"]

        def fake_get(url):
            after = None
            if "afterId=" in url:
                after = url.split("afterId=", 1)[1].split("&", 1)[0]
            limit = int(url.split("limit=", 1)[1].split("&", 1)[0])
            candidates = [i for i in store if after is None or i > after]
            return [{"_id": i, "shape": "point"} for i in candidates[:limit]]

        mock_gc.get.side_effect = fake_get
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        seen = []
        for ann in accessor.iter_all(page_size=2):
            seen.append(ann.id)
            store.remove(ann.id)  # delete immediately after yielding

        assert seen == ["a1", "a2", "a3", "a4", "a5"]


class TestAnnotationList:
    def test_list_all(self, mock_gc, sample_annotation_dict):
        mock_gc.get.return_value = [sample_annotation_dict]
        accessor = AnnotationAccessor(mock_gc, "dataset_001")

        result = accessor.list()
        assert len(result) == 1
        assert isinstance(result[0], Annotation)
        assert result[0].id == "ann_001"
        mock_gc.get.assert_called_once()
        call_url = mock_gc.get.call_args[0][0]
        assert "datasetId=dataset_001" in call_url
        assert "limit=0" in call_url

    def test_list_with_filters(self, mock_gc):
        mock_gc.get.return_value = []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        accessor.list(shape="polygon", tags=["nucleus"], limit=100)
        call_url = mock_gc.get.call_args[0][0]
        assert "shape=polygon" in call_url
        assert "limit=100" in call_url


class TestAnnotationGet:
    def test_get_by_id(self, mock_gc, sample_annotation_dict):
        mock_gc.get.return_value = sample_annotation_dict
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        ann = accessor.get("ann_001")
        assert isinstance(ann, Annotation)
        assert ann.id == "ann_001"
        mock_gc.get.assert_called_with("upenn_annotation/ann_001")


class TestAnnotationCount:
    def test_count(self, mock_gc):
        mock_gc.get.return_value = {"count": 42}
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        result = accessor.count(shape="polygon")
        assert result == 42


class TestTagQueryEncoding:
    """Tags are free text: "+" must not decode to a space and "&" must not
    split the query string."""

    @pytest.mark.parametrize("call", ["count", "list"])
    def test_special_characters_survive(self, mock_gc, call):
        from urllib.parse import parse_qs, urlsplit

        mock_gc.get.return_value = {"count": 0} if call == "count" else []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        getattr(accessor, call)(tags=["CD8+", "a&b", "with space"])
        query = parse_qs(urlsplit(mock_gc.get.call_args[0][0]).query)
        assert query["tags"] == ['["CD8+", "a&b", "with space"]']
        assert query["datasetId"] == ["ds_001"]


class TestAnnotationCreate:
    def test_create_single(self, mock_gc, sample_annotation_dict):
        mock_gc.post.return_value = sample_annotation_dict
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        ann = Annotation(
            id=None, shape="polygon", tags=["nucleus"], channel=0,
            location=Location(), coordinates=[{"x": 1, "y": 2}],
            dataset_id="ds_001",
        )
        result = accessor.create(ann)
        assert isinstance(result, Annotation)
        assert result.id == "ann_001"
        mock_gc.post.assert_called_once()

    def test_create_many(self, mock_gc, sample_annotation_dict):
        mock_gc.post.return_value = [sample_annotation_dict]
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        ann = Annotation(
            id=None, shape="polygon", tags=[], channel=0,
            location=Location(), coordinates=[], dataset_id="ds_001",
        )
        result = accessor.create_many([ann])
        assert len(result) == 1
        mock_gc.post.assert_called_once()
        call_url = mock_gc.post.call_args[0][0]
        assert "multiple" in call_url

    def test_create_many_with_connect_to(
        self, mock_gc, sample_annotation_dict,
    ):
        # First call: create annotations
        mock_gc.post.side_effect = [
            [sample_annotation_dict],  # create multiple
            None,  # connect to nearest
        ]
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        ann = Annotation(
            id=None, shape="polygon", tags=[], channel=0,
            location=Location(), coordinates=[], dataset_id="ds_001",
        )
        result = accessor.create_many(
            [ann], connect_to={"tags": ["cell"], "channel": 0}
        )
        assert len(result) == 1
        assert mock_gc.post.call_count == 2


class TestAnnotationUpdate:
    def test_update_single(self, mock_gc, sample_annotation_dict):
        updated = {**sample_annotation_dict, "tags": ["updated"]}
        mock_gc.put.return_value = updated
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        result = accessor.update("ann_001", {"tags": ["updated"]})
        assert isinstance(result, Annotation)
        assert result.tags == ["updated"]

    def test_update_many(self, mock_gc):
        mock_gc.put.return_value = []
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        accessor.update_many([
            ("id1", {"tags": ["a"]}),
            ("id2", {"tags": ["b"]}),
        ])
        call_url = mock_gc.put.call_args[0][0]
        assert "multiple" in call_url


class TestAnnotationDelete:
    def test_delete_single(self, mock_gc):
        accessor = AnnotationAccessor(mock_gc, "ds_001")
        accessor.delete("ann_001")
        mock_gc.delete.assert_called_with("upenn_annotation/ann_001")

    def test_delete_many(self, mock_gc):
        accessor = AnnotationAccessor(mock_gc, "ds_001")
        accessor.delete_many(["id1", "id2", "id3"])
        mock_gc.sendRestRequest.assert_called_once()
        args = mock_gc.sendRestRequest.call_args
        assert args[0][0] == "DELETE"
        assert "multiple" in args[0][1]


class TestGetMany:
    def test_one_hydrate_request(self, mock_gc, sample_annotation_dict):
        mock_gc.post.return_value = [sample_annotation_dict]
        accessor = AnnotationAccessor(mock_gc, "dataset_001")
        result = accessor.get_many(["ann_001", "ann_missing"])
        mock_gc.post.assert_called_once_with(
            "upenn_annotation/hydrate", json=["ann_001", "ann_missing"]
        )
        assert [a.id for a in result] == ["ann_001"]

    def test_scoped_to_the_dataset(self, mock_gc, sample_annotation_dict):
        other = {**sample_annotation_dict, "_id": "x", "datasetId": "other"}
        mock_gc.post.return_value = [sample_annotation_dict, other]
        result = AnnotationAccessor(mock_gc, "dataset_001").get_many(
            ["ann_001", "x"]
        )
        assert [a.id for a in result] == ["ann_001"]

    def test_accepts_a_numpy_array(self, mock_gc, sample_annotation_dict):
        import numpy as np

        mock_gc.post.return_value = [sample_annotation_dict]
        ids = np.array(["ann_001", "ann_002"], dtype=object)
        AnnotationAccessor(mock_gc, "dataset_001").get_many(ids)
        mock_gc.post.assert_called_once_with(
            "upenn_annotation/hydrate", json=["ann_001", "ann_002"]
        )

    def test_empty_list_makes_no_request(self, mock_gc):
        assert AnnotationAccessor(mock_gc, "dataset_001").get_many([]) == []
        mock_gc.post.assert_not_called()


class TestAnnotationSummary:
    """ds.annotations.summary() wraps POST upenn_annotation/summary."""

    RESPONSE = {
        "total": 4,
        "tags": [{"tag": "A", "count": 3}, {"tag": "B", "count": 1}],
        "shapes": [
            {"shape": "polygon", "count": 3}, {"shape": "point", "count": 1},
        ],
        "channels": [
            {"channel": 2, "count": 3}, {"channel": 0, "count": 1},
        ],
        "properties": [
            {"path": ["p", "Area"], "count": 2, "mean": 10.0, "std": 7.07,
             "min": 5.0, "max": 15.0},
            {"path": ["p", "Nope"], "count": 0, "mean": None, "std": None,
             "min": None, "max": None},
        ],
    }

    def test_posts_the_summary_request_and_parses_it(self, mock_gc):
        mock_gc.post.return_value = self.RESPONSE
        accessor = AnnotationAccessor(mock_gc, "ds_001")

        s = accessor.summary(property_paths=[("p", "Area"), ["p", "Nope"]])

        mock_gc.post.assert_called_once_with("upenn_annotation/summary", json={
            "datasetId": "ds_001",
            "filters": {},
            "propertyPaths": [["p", "Area"], ["p", "Nope"]],
        })
        assert s.total == 4
        # Server order (count desc) is kept.
        assert list(s.tags.items()) == [("A", 3), ("B", 1)]
        assert s.shapes == {"polygon": 3, "point": 1}
        # Keyed by channel index (an int, as the app's layers use), in the
        # server's count order.
        assert list(s.channels.items()) == [(2, 3), (0, 1)]
        assert s.properties[0].path == ["p", "Area"]
        assert s.properties[0].mean == 10.0
        assert s.properties[1].count == 0 and s.properties[1].mean is None

    def test_shape_and_tags_become_list_filters(self, mock_gc):
        mock_gc.post.return_value = self.RESPONSE
        accessor = AnnotationAccessor(mock_gc, "ds_001")
        extra = {"location": {"Z": 0}}

        accessor.summary(
            shape="point", tags=["CD8+"], exclusive=True, filters=extra,
        )

        assert mock_gc.post.call_args.kwargs["json"]["filters"] == {
            "location": {"Z": 0},
            "shape": "point",
            "tags": {"values": ["CD8+"], "exclusive": True},
        }
        assert extra == {"location": {"Z": 0}}  # caller's dict untouched

    @pytest.mark.parametrize("kwargs", [
        {"shape": "point", "filters": {"shape": "polygon"}},
        {"tags": ["A"], "filters": {"tags": {"values": ["B"]}}},
    ])
    def test_rejects_the_same_filter_twice(self, mock_gc, kwargs):
        with pytest.raises(ValueError, match="not both"):
            AnnotationAccessor(mock_gc, "ds_001").summary(**kwargs)
        mock_gc.post.assert_not_called()

    @pytest.mark.parametrize("kwargs, error", [
        ({"tags": "cell"}, TypeError),
        ({"property_paths": ["prop.Area"]}, TypeError),
        ({"exclusive": True}, ValueError),
    ])
    def test_rejects_misshapen_arguments(self, mock_gc, kwargs, error):
        """A bare string would be split into characters and silently match
        the wrong thing; exclusive without tags would be ignored."""
        with pytest.raises(error):
            AnnotationAccessor(mock_gc, "ds_001").summary(**kwargs)
        mock_gc.post.assert_not_called()

    def test_duplicate_tags_are_sent_once(self, mock_gc):
        """The server's exclusive match compares the tag-set size with
        len(values); a duplicate would make it match nothing."""
        mock_gc.post.return_value = self.RESPONSE
        AnnotationAccessor(mock_gc, "ds_001").summary(
            tags=["a", "b", "a"], exclusive=True,
        )
        assert mock_gc.post.call_args.kwargs["json"]["filters"]["tags"] == {
            "values": ["a", "b"], "exclusive": True,
        }

    def test_empty_tag_list_is_a_filter_not_absent(self, mock_gc):
        """tags=[] is sent (the server reads empty values as no tag
        filter); only None leaves the key out."""
        mock_gc.post.return_value = self.RESPONSE
        AnnotationAccessor(mock_gc, "ds_001").summary(tags=[])
        assert mock_gc.post.call_args.kwargs["json"]["filters"] == {
            "tags": {"values": [], "exclusive": False},
        }

    def test_shapes_is_none_on_servers_without_the_breakdown(self, mock_gc):
        mock_gc.post.return_value = {"total": 0, "tags": [], "properties": []}
        s = AnnotationAccessor(mock_gc, "ds_001").summary()
        assert s.shapes is None
        assert s.channels is None
        assert s.tags == {} and s.properties == []
