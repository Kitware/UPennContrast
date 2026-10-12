"""
Endpoints must not reveal fields the caller's access level hides — the
`access` ACL above all, which names other users. Each test uses a READ-only
caller on resources another user owns, as POST /resource/batch's tests do.
"""
import json

import pytest

from pytest_girder.assertions import assertStatus, assertStatusOk

from girder.constants import AccessType
from girder.models.folder import Folder
from girder.models.item import Item

from upenncontrast_annotation.server.api.export import Export
from upenncontrast_annotation.server.helpers import validation
from upenncontrast_annotation.server.models.collection import Collection
from upenncontrast_annotation.server.models.datasetView import (
    DatasetView as DatasetViewModel
)
from upenncontrast_annotation.server.models.property import (
    AnnotationProperty
)
from upenncontrast_annotation.server.models.workerInterfaces import (
    WorkerInterfaceModel
)
from upenncontrast_annotation.server.models.workerPreviews import (
    WorkerPreviewModel
)

from . import girder_utilities as utilities
from . import upenn_testing_utilities as upenn_utilities


PROPERTY_FIELDS = {
    "name": "Area",
    "image": "properties/area:latest",
    "tags": {"tags": ["cell"], "exclusive": False},
    "shape": "polygon",
    "workerInterface": {},
}


def configMetadata(propertyIds=()):
    return {
        "subtype": "contrastConfiguration",
        "compatibility": {},
        "layers": [],
        "tools": [],
        "propertyIds": [str(pid) for pid in propertyIds],
        "snapshots": [],
        "scales": {},
    }


def createDataset(owner, name, private=True):
    create = (
        utilities.createPrivateFolder if private else utilities.createFolder
    )
    return create(owner, name, upenn_utilities.datasetMetadata)


def createView(owner, dataset, config):
    return DatasetViewModel().create(owner, {
        "datasetId": dataset["_id"],
        "configurationId": config["_id"],
        "lastLocation": {"xy": 0, "z": 0, "time": 0},
        "layerContrasts": {},
    })


def createSharedProperty(admin, user):
    """A property admin created, readable by user through a READ-shared
    configuration on a READ-shared dataset."""
    prop = AnnotationProperty().create(admin, dict(PROPERTY_FIELDS))
    dataset = createDataset(admin, "shared_ds")
    Folder().setUserAccess(dataset, user, AccessType.READ, save=True)
    config = Collection().createCollection(
        "SharedConfig", admin, dataset, configMetadata([prop["_id"]])
    )
    Collection().setUserAccess(config, user, AccessType.READ, save=True)
    return prop, dataset, config


def assertPublicPropertyShape(doc, prop, accessLevel=AccessType.READ):
    assert "access" not in doc
    assert doc["_id"] == str(prop["_id"])
    for key, value in PROPERTY_FIELDS.items():
        assert doc[key] == value, key
    # The property's own ACL names only its creator; a configuration reader
    # is still reported as READ, not -1.
    assert doc["_accessLevel"] == accessLevel


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestPropertyHiddenFields:

    def testGetOmitsAcl(self, admin, user, server):
        prop, _, _ = createSharedProperty(admin, user)
        # The raw document's ACL names its creator.
        raw = AnnotationProperty().load(prop["_id"], force=True)
        assert raw["access"]["users"][0]["id"] == admin["_id"]

        resp = server.request(
            path="/annotation_property/%s" % prop["_id"], user=user
        )

        assertStatusOk(resp)
        assertPublicPropertyShape(resp.json, prop)

    def testListOmitsAcl(self, admin, user, server):
        prop, _, _ = createSharedProperty(admin, user)

        resp = server.request(path="/annotation_property", user=user)

        assertStatusOk(resp)
        assert len(resp.json) == 1
        # Filtering keeps the cursor's paging header.
        assert str(resp.headers["Girder-Total-Count"]) == "1"
        assertPublicPropertyShape(resp.json[0], prop)

    def testAnonymousSeesPublicConfigurationProperties(self, admin, server):
        prop = AnnotationProperty().create(admin, dict(PROPERTY_FIELDS))
        dataset = createDataset(admin, "public_ds", private=False)
        config = Collection().createCollection(
            "PublicConfig", admin, dataset, configMetadata([prop["_id"]])
        )
        Collection().setPublic(config, True, save=True)

        resp = server.request(path="/annotation_property")

        assertStatusOk(resp)
        assert len(resp.json) == 1
        assertPublicPropertyShape(resp.json[0], prop)

    def testCreateOmitsAcl(self, user, server):
        resp = server.request(
            path="/annotation_property",
            method="POST",
            user=user,
            body=json.dumps(PROPERTY_FIELDS),
            type="application/json",
        )

        assertStatusOk(resp)
        assert "access" not in resp.json
        assert resp.json["name"] == PROPERTY_FIELDS["name"]
        assert resp.json["_accessLevel"] == AccessType.ADMIN
        assert AnnotationProperty().load(resp.json["_id"], force=True)[
            "access"
        ]

    def testJsonExportOmitsPropertyAcl(self, admin, user):
        # Calls the export's property helper directly: GET /export/json
        # currently refuses every non-admin caller (the share-link guard's
        # `before` handler declares no access level, so Girder demands
        # site admin).
        prop, dataset, config = createSharedProperty(admin, user)

        exported = Export()._getProperties(
            dataset["_id"], config["_id"], user
        )

        assert len(exported) == 1
        assertPublicPropertyShape(
            {**exported[0], "_id": str(exported[0]["_id"])}, prop
        )


def postPropertyBatch(server, user, body):
    return server.request(
        path="/annotation_property/batch",
        method="POST",
        user=user,
        body=json.dumps(body),
        type="application/json",
    )


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestPropertyBatch:

    def testReturnsReadablePropertiesInRequestOrder(
        self, admin, user, server
    ):
        first, dataset, config = createSharedProperty(admin, user)
        second = AnnotationProperty().create(admin, dict(PROPERTY_FIELDS))
        Collection().setMetadata(config, {"propertyIds": [
            str(first["_id"]), str(second["_id"]),
        ]})
        # Only admin's private configuration references this one.
        hidden = AnnotationProperty().create(admin, dict(PROPERTY_FIELDS))
        Collection().createCollection(
            "PrivateConfig", admin, createDataset(admin, "private_ds"),
            configMetadata([hidden["_id"]]),
        )
        missing = "0" * 24

        resp = postPropertyBatch(server, user, {"ids": [
            str(second["_id"]), missing, str(hidden["_id"]),
            str(first["_id"]), str(second["_id"]),
        ]})

        assertStatusOk(resp)
        assert [p["_id"] for p in resp.json] == [
            str(second["_id"]), str(first["_id"]),
        ]
        assertPublicPropertyShape(resp.json[0], second)
        assertPublicPropertyShape(resp.json[1], first)

        # The site admin reads every configuration.
        resp = postPropertyBatch(server, admin, {"ids": [
            str(hidden["_id"]), missing,
        ]})
        assertStatusOk(resp)
        assert [p["_id"] for p in resp.json] == [str(hidden["_id"])]

    def testEmptyListReturnsNothing(self, user, server):
        resp = postPropertyBatch(server, user, {"ids": []})

        assertStatusOk(resp)
        assert resp.json == []

    @pytest.mark.parametrize("body, message", [
        ({}, "ids must be a list"),
        ({"ids": "abc"}, "ids must be a list"),
        ({"ids": ["notanobjectid"]}, "ids is not a valid id"),
        ({"ids": [123]}, "ids is not a valid id"),
    ])
    def testMalformedIdsAreRejected(self, user, server, body, message):
        resp = postPropertyBatch(server, user, body)

        assertStatus(resp, 400)
        assert message in resp.json["message"]

    def testTooManyIdsAreRejected(self, user, server, monkeypatch):
        monkeypatch.setattr(validation, "MAX_PROPERTY_IDS", 2)

        resp = postPropertyBatch(server, user, {"ids": ["0" * 24] * 3})

        assertStatus(resp, 400)
        assert "ids exceeds the maximum of 2" in resp.json["message"]
        assertStatusOk(
            postPropertyBatch(server, user, {"ids": ["0" * 24] * 2})
        )


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestWorkerPreviewHiddenFields:

    def testGetOmitsAcl(self, admin, user, server):
        image = "test/worker:latest"
        preview = {"image": "data:image/png;base64,AAAA", "text": "hi"}
        WorkerPreviewModel().create(admin, image, preview)

        resp = server.request(
            path="/worker_preview", user=user, params={"image": image}
        )

        assertStatusOk(resp)
        assert "access" not in resp.json
        assert resp.json["image"] == image
        assert resp.json["preview"] == preview

    def testPostResponsesOmitAcl(self, admin, user, server):
        image = "test/worker:latest"
        # admin registered the interface first; user's update returns the
        # same document, whose ACL names admin.
        WorkerInterfaceModel().create(admin, image, {"a": {"type": "text"}})

        resp = server.request(
            path="/worker_interface", method="POST", user=user,
            params={"image": image},
            body=json.dumps({"b": {"type": "text"}}),
            type="application/json",
        )

        assertStatusOk(resp)
        assert "access" not in resp.json
        assert resp.json["_id"]
        assert resp.json["interface"] == {"b": {"type": "text"}}

        resp = server.request(
            path="/worker_preview", method="POST", user=admin,
            params={"image": image},
            body=json.dumps({"image": "data:,x"}),
            type="application/json",
        )

        assertStatusOk(resp)
        assert "access" not in resp.json
        assert resp.json["_id"]
        assert resp.json["preview"] == {"image": "data:,x"}

    def testMissingPreviewIsEmpty(self, user, server):
        resp = server.request(
            path="/worker_preview", user=user, params={"image": "nope"}
        )

        assertStatusOk(resp)
        assert resp.json == {}


VIEW_FIELDS = (
    "_id", "datasetId", "configurationId", "layerContrasts", "lastLocation",
)


def createSharedView(admin, user, level=AccessType.READ):
    """A view admin owns, shared with user at `level`."""
    dataset = createDataset(admin, "shared_ds")
    config = Collection().createCollection(
        "SharedConfig", admin, dataset, configMetadata()
    )
    view = createView(admin, dataset, config)
    view = DatasetViewModel().setUserAccess(view, user, level, save=True)
    assert len(view["access"]["users"]) == 2
    return view


def assertPublicViewShape(doc, view, accessLevel):
    assert "access" not in doc
    for key in VIEW_FIELDS:
        assert doc[key] == json.loads(json.dumps(view[key], default=str)), key
    assert doc["_accessLevel"] == accessLevel


# Every field the frontend reads from a view (asDatasetView in
# src/store/GirderAPI.ts), with values that would show if one were dropped.
FRONTEND_VIEW_FIELDS = {
    "layerContrasts": {
        "layer1": {"mode": "absolute", "blackPoint": 1, "whitePoint": 9},
    },
    "scales": {"pixelSize": {"value": 0.5, "unit": "um"}},
    "lastViewed": 1700000000000,
    "lastLocation": {"xy": 1, "z": 2, "time": 3},
}


def readViewViaEveryEndpoint(server, caller, view):
    """`view` as get, find and bulk_find each return it to `caller`."""
    viewId = str(view["_id"])
    datasetId = str(view["datasetId"])
    resp = server.request(path="/dataset_view/%s" % viewId, user=caller)
    assertStatusOk(resp)
    results = {"get": resp.json}

    resp = server.request(
        path="/dataset_view", user=caller, params={"datasetId": datasetId}
    )
    assertStatusOk(resp)
    results["find"] = next(v for v in resp.json if v["_id"] == viewId)

    resp = server.request(
        path="/dataset_view/bulk_find",
        method="POST",
        user=caller,
        body=json.dumps({"datasetIds": [datasetId]}),
        type="application/json",
    )
    assertStatusOk(resp)
    results["bulk_find"] = next(v for v in resp.json if v["_id"] == viewId)
    return results


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestDatasetViewHiddenFields:

    def testGetOmitsAcl(self, admin, user, server):
        view = createSharedView(admin, user)

        resp = server.request(
            path="/dataset_view/%s" % view["_id"], user=user
        )

        assertStatusOk(resp)
        assertPublicViewShape(resp.json, view, AccessType.READ)

    def testFindOmitsAcl(self, admin, user, server):
        view = createSharedView(admin, user)

        resp = server.request(
            path="/dataset_view",
            user=user,
            params={"datasetId": str(view["datasetId"])},
        )

        assertStatusOk(resp)
        assert len(resp.json) == 1
        assertPublicViewShape(resp.json[0], view, AccessType.READ)

    def testBulkFindOmitsAcl(self, admin, user, server):
        view = createSharedView(admin, user)

        resp = server.request(
            path="/dataset_view/bulk_find",
            method="POST",
            user=user,
            body=json.dumps({"datasetIds": [str(view["datasetId"])]}),
            type="application/json",
        )

        assertStatusOk(resp)
        assert len(resp.json) == 1
        assertPublicViewShape(resp.json[0], view, AccessType.READ)

    def testCreateReturningAnExistingViewOmitsAcl(self, admin, user, server):
        # POSTing a view that already exists updates and returns that view,
        # which here is admin's, shared with user for writing.
        view = createSharedView(admin, user, AccessType.WRITE)

        resp = server.request(
            path="/dataset_view",
            method="POST",
            user=user,
            body=json.dumps({
                "datasetId": str(view["datasetId"]),
                "configurationId": str(view["configurationId"]),
                "lastLocation": {"xy": 0, "z": 1, "time": 0},
                "layerContrasts": {},
            }),
            type="application/json",
        )

        assertStatusOk(resp)
        assert resp.json["_id"] == str(view["_id"])
        assert "access" not in resp.json
        assert resp.json["lastLocation"] == {"xy": 0, "z": 1, "time": 0}
        assert resp.json["_accessLevel"] == AccessType.WRITE

    def testAnonymousViewerOfPublicDatasetSeesNoCollaborators(
        self, admin, user, server
    ):
        view = createSharedView(admin, user, AccessType.WRITE)
        DatasetViewModel().setPublic(view, True, save=True)
        Folder().setPublic(
            Folder().load(view["datasetId"], force=True), True, save=True
        )

        for endpoint, doc in readViewViaEveryEndpoint(
            server, None, view
        ).items():
            assert "access" not in doc, endpoint
            assert str(user["_id"]) not in json.dumps(doc), endpoint
            assert doc["_accessLevel"] == AccessType.READ, endpoint

    def testEveryFieldTheFrontendReadsSurvives(self, admin, server):
        dataset = createDataset(admin, "own_ds")
        config = Collection().createCollection(
            "OwnConfig", admin, dataset, configMetadata()
        )
        view = createView(admin, dataset, config)
        view.update(json.loads(json.dumps(FRONTEND_VIEW_FIELDS)))
        view = DatasetViewModel().save(view)

        for endpoint, doc in readViewViaEveryEndpoint(
            server, admin, view
        ).items():
            assert doc["_id"] == str(view["_id"]), endpoint
            assert doc["datasetId"] == str(view["datasetId"]), endpoint
            assert doc["configurationId"] == str(
                view["configurationId"]
            ), endpoint
            for key, value in FRONTEND_VIEW_FIELDS.items():
                assert doc[key] == value, (endpoint, key)
            assert doc["_accessLevel"] == AccessType.ADMIN, endpoint

    def testStoredAccessLevelIsNotReported(self, admin, user, server):
        # The frontend PUTs back the view it holds, so older documents store
        # the owner's `_accessLevel` (and `id`); find used to return that
        # stored value to every caller.
        view = createSharedView(admin, user)
        view["_accessLevel"] = AccessType.ADMIN
        view["id"] = str(view["_id"])
        view = DatasetViewModel().save(view)

        for endpoint, doc in readViewViaEveryEndpoint(
            server, user, view
        ).items():
            assert doc["_accessLevel"] == AccessType.READ, endpoint
            assert "id" not in doc, endpoint


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestAccessListsOmitUnreadable:

    def testConfigurationAccessOmitsUnreadableDatasets(
        self, admin, user, server
    ):
        # user owns a configuration and opened it with their own dataset;
        # admin later opened it with a private dataset of theirs.
        userDataset = createDataset(user, "user_ds")
        config = Collection().createCollection(
            "UserConfig", user, userDataset, configMetadata()
        )
        createView(user, userDataset, config)
        adminDataset = createDataset(admin, "admin_secret_ds")
        createView(admin, adminDataset, config)

        resp = server.request(
            path="/dataset_view/configuration_access/%s" % config["_id"],
            user=user,
        )

        assertStatusOk(resp)
        assert [d["id"] for d in resp.json["datasets"]] == [
            str(userDataset["_id"])
        ]

        # The site admin can read both.
        resp = server.request(
            path="/dataset_view/configuration_access/%s" % config["_id"],
            user=admin,
        )
        assertStatusOk(resp)
        assert {d["id"] for d in resp.json["datasets"]} == {
            str(userDataset["_id"]), str(adminDataset["_id"])
        }

    def testDatasetAccessOmitsUnreadableConfigurations(
        self, admin, user, server
    ):
        dataset = createDataset(user, "user_ds")
        userConfig = Collection().createCollection(
            "UserConfig", user, dataset, configMetadata()
        )
        createView(user, dataset, userConfig)
        adminFolder = createDataset(admin, "admin_folder")
        adminConfig = Collection().createCollection(
            "AdminSecretConfig", admin, adminFolder, configMetadata()
        )
        createView(admin, dataset, adminConfig)

        resp = server.request(
            path="/dataset_view/access/%s" % dataset["_id"], user=user
        )

        assertStatusOk(resp)
        assert [c["id"] for c in resp.json["configurations"]] == [
            str(userConfig["_id"])
        ]


def queryEndpoint(server, user, kind, query, **params):
    return server.request(
        path="/%s/query" % kind,
        user=user,
        params={"query": json.dumps(query), **params},
    )


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestQueryEndpointsRejectHiddenFields:

    @pytest.mark.parametrize("kind", ["folder", "item"])
    @pytest.mark.parametrize("query, message", [
        ({"access.users.id": "x"}, "may not match on the field access"),
        ({"access": {"$exists": True}}, "may not match on the field access"),
        ({"$or": [{"name": "a"}, {"access.users.level": 2}]},
         "may not match on the field access"),
        ({"$and": [{"$nor": [{"lowerName": "a"}]}]},
         "may not match on the field lowerName"),
        ({"$expr": {"$gt": ["$access", None]}},
         "may not use the $expr operator"),
        ({"$where": "true"}, "may not use the $where operator"),
        ({"$or": {"name": "a"}}, "query.$or must be a non-empty list"),
        ({"$and": []}, "query.$and must be a non-empty list"),
        ({"$or": ["name"]}, "query must be a JSON object"),
    ])
    def testHiddenFieldQueriesAreRejected(
        self, user, server, kind, query, message
    ):
        resp = queryEndpoint(server, user, kind, query)

        assertStatus(resp, 400)
        assert message in resp.json["message"]

    @pytest.mark.parametrize("kind", ["folder", "item"])
    def testHiddenFieldSortIsRejected(self, user, server, kind):
        resp = queryEndpoint(
            server, user, kind, {"name": "x"}, sort="access.users.id"
        )

        assertStatus(resp, 400)
        assert "sort may not use the field access" in resp.json["message"]

    def testVisibleFieldQueriesStillWork(self, admin, user, server):
        dataset = createDataset(admin, "shared_ds")
        Folder().setUserAccess(dataset, user, AccessType.READ, save=True)

        resp = queryEndpoint(server, user, "folder", {
            "$and": [
                {"name": "shared_ds"},
                {"description": {"$in": ["", None]}},
            ],
        }, sort="name")

        assertStatusOk(resp)
        assert [f["_id"] for f in resp.json] == [str(dataset["_id"])]
        assert "access" not in resp.json[0]

        # The frontend's compatible-configuration lookup shape.
        item = Item().createItem("legacy_config", admin, dataset)
        Item().setMetadata(item, {
            "subtype": "contrastConfiguration", "compatibility": {},
        })
        resp = queryEndpoint(server, user, "item", {
            "meta.subtype": "contrastConfiguration",
            "meta.compatibility": {},
        }, sort="updated", sortdir=-1)
        assertStatusOk(resp)
        assert [i["_id"] for i in resp.json] == [str(item["_id"])]
