"""Which annotation_property fields the API returns, accepts and exports.

A property document carries its own Girder `access` ACL, but who may READ a
property is decided by the configurations that reference it, so callers who
are nowhere in that ACL -- READ collaborators, anonymous viewers of a public
dataset -- can fetch it. The endpoints used to return raw documents, which
handed every such caller the ACL: the id of every user the property was ever
shared with, which `GET user/{id}` turns into names. The JSON export and the
Zenodo archive embedded the same raw documents.

The write side is the twin: create saved the raw request body, so a caller
could store `public` or an `access` list on their new property.

The worker_interface / worker_preview documents have the same shape (an ACL
naming the user whose request first created them) and the same fix.
"""
import json
import random

import orjson
import pytest

from girder.constants import AccessType
from girder.models.folder import Folder

from pytest_girder.assertions import assertStatus, assertStatusOk

from upenncontrast_annotation.server.helpers import zenodo_job
from upenncontrast_annotation.server.models.annotation import Annotation
from upenncontrast_annotation.server.models.collection import Collection
from upenncontrast_annotation.server.models.connections import (
    AnnotationConnection,
)
from upenncontrast_annotation.server.models.datasetView import DatasetView
from upenncontrast_annotation.server.models.property import (
    AnnotationProperty,
)
from upenncontrast_annotation.server.models.propertyValues import (
    AnnotationPropertyValues,
)
from upenncontrast_annotation.server.models.workerInterfaces import (
    WorkerInterfaceModel,
)
from upenncontrast_annotation.server.models.workerPreviews import (
    WorkerPreviewModel,
)

from . import girder_utilities as utilities
from . import upenn_testing_utilities as upenn_utilities


# Every field the frontend (PropertiesAPI.toProperty and
# fromPropertyConfiguration, annotationImport.ts), the nimbusimage package
# (models.Property) and the JSON import read from a property. `id` there is
# the response's `_id`.
CONSUMER_FIELDS = {
    "_id", "name", "image", "tags", "shape", "workerInterface",
}
# Girder's filterDocument stamps every filtered document with this.
RESPONSE_FIELDS = CONSUMER_FIELDS | {"_modelType"}

PROPERTY_BODY = {
    "name": "Blob metrics",
    "image": "properties/blob_metrics:latest",
    "tags": {"tags": ["nucleus"], "exclusive": False},
    "shape": "polygon",
    "workerInterface": {"Radius": 3},
}


def createSharedProperty(owner, collaborator=None, level=AccessType.READ,
                         public=False):
    """A dataset and configuration owned by `owner` whose configuration
    references a property that `owner` has also shared with `collaborator`
    -- so the property's ACL names a second user."""
    dataset = utilities.createFolder(
        owner, f"prop_fields_{random.random()}",
        upenn_utilities.datasetMetadata,
    )
    prop = AnnotationProperty().create(
        owner, json.loads(json.dumps(PROPERTY_BODY)))
    if collaborator is not None:
        AnnotationProperty().setUserAccess(
            prop, collaborator, AccessType.WRITE, save=True)
    config = Collection().createCollection(
        name=f"prop_fields_config_{random.random()}",
        creator=owner, folder=dataset,
        metadata={
            "subtype": "contrastDataset", "compatibility": {}, "layers": [],
            "tools": [], "propertyIds": [str(prop["_id"])], "snapshots": [],
            "scales": {},
        },
    )
    DatasetView().create(owner, {
        "datasetId": dataset["_id"],
        "configurationId": config["_id"],
        "layerContrasts": {},
        "lastLocation": {"xy": 0, "z": 0, "time": 0},
    })
    if collaborator is not None:
        Collection().setUserAccess(config, collaborator, level, save=True)
        Folder().setUserAccess(dataset, collaborator, level, save=True)
    if public:
        Collection().setPublic(config, True, save=True)
        Folder().setPublic(dataset, True, save=True)
    return dataset, config, prop


def readViaEveryEndpoint(server, caller, prop, dataset, config):
    """The property as returned by get, the list, and the JSON export (with
    and without a configuration), for `caller`."""
    propId = str(prop["_id"])

    resp = server.request(path=f"/annotation_property/{propId}", user=caller)
    assertStatusOk(resp)
    results = {"get": resp.json}

    resp = server.request(path="/annotation_property", user=caller)
    assertStatusOk(resp)
    results["list"] = next(p for p in resp.json if p["_id"] == propId)

    for label, params in (
        ("export", {}),
        ("export+config", {"configurationId": str(config["_id"])}),
    ):
        resp = server.request(
            path="/export/json", user=caller, isJson=False,
            params={"datasetId": str(dataset["_id"]), **params})
        assertStatusOk(resp)
        exported = json.loads(b"".join(resp.body))
        results[label] = next(
            p for p in exported["annotationProperties"]
            if p["_id"] == propId)
    return results


def assertConsumerFieldsSurvive(doc, prop, label):
    assert doc["_id"] == str(prop["_id"]), label
    for key, value in PROPERTY_BODY.items():
        assert doc[key] == value, (label, key)


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestPropertyResponseFields:

    def testReadOnlyCollaboratorDoesNotReceiveAccess(
            self, admin, user, server):
        dataset, config, prop = createSharedProperty(admin, user)

        results = readViaEveryEndpoint(server, user, prop, dataset, config)
        for label, doc in results.items():
            assert "access" not in doc, label
            assertConsumerFieldsSurvive(doc, prop, label)
        for label in ("get", "list"):
            assert set(results[label]) == RESPONSE_FIELDS, label
        for label in ("export", "export+config"):
            assert set(results[label]) == CONSUMER_FIELDS, label

    def testAnonymousViewerOfPublicDatasetDoesNotReceiveAccess(
            self, admin, user, server):
        dataset, config, prop = createSharedProperty(
            admin, user, public=True)

        results = readViaEveryEndpoint(server, None, prop, dataset, config)
        for label, doc in results.items():
            assert "access" not in doc, label
            assert str(user["_id"]) not in json.dumps(doc), label
            assert str(admin["_id"]) not in json.dumps(doc), label
            assertConsumerFieldsSurvive(doc, prop, label)

    def testResponsesCarryNoAccessLevel(self, admin, user, server):
        """filter() would report the caller's level on the property's OWN
        ACL, which does not decide who reads it: a READ collaborator via the
        configuration would be told NONE. So no level is reported."""
        dataset, config, prop = createSharedProperty(admin, user)
        for caller in (admin, user):
            results = readViaEveryEndpoint(
                server, caller, prop, dataset, config)
            for label, doc in results.items():
                assert "_accessLevel" not in doc, label

    def testZenodoArchiveDoesNotEmbedAccess(self, admin, user):
        dataset, _, prop = createSharedProperty(admin, user)

        archived = orjson.loads(zenodo_job._build_annotation_json(
            dataset["_id"], Annotation(), AnnotationConnection(),
            Collection(), DatasetView(), AnnotationProperty(),
            AnnotationPropertyValues(),
        ))
        doc = next(
            p for p in archived["annotationProperties"]
            if p["_id"] == str(prop["_id"]))
        assert set(doc) == CONSUMER_FIELDS
        assertConsumerFieldsSurvive(doc, prop, "zenodo")


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestPropertyCreateFields:

    def testCreateStoresAndReturnsClientFieldsOnly(self, user, admin,
                                                   server):
        body = {
            **PROPERTY_BODY,
            "public": True,
            "access": {"users": [
                {"id": str(admin["_id"]), "level": AccessType.ADMIN,
                 "flags": []},
            ], "groups": []},
            "_accessLevel": AccessType.ADMIN,
            "unknownField": True,
        }
        resp = server.request(
            path="/annotation_property", method="POST", user=user,
            type="application/json", body=json.dumps(body))
        assertStatusOk(resp)
        assert set(resp.json) == RESPONSE_FIELDS
        for key, value in PROPERTY_BODY.items():
            assert resp.json[key] == value, key

        stored = AnnotationProperty().load(resp.json["_id"], force=True)
        assert stored.get("public", False) is False
        assert stored["access"]["users"] == [
            {"id": user["_id"], "level": AccessType.ADMIN, "flags": []}]
        assert "_accessLevel" not in stored
        assert "unknownField" not in stored

    def testClientFieldsMatchTheSchema(self):
        """create/update store the schema's fields (filterUpdateFields) while
        responses and exports expose CLIENT_FIELDS; if the two drift, a new
        field is stored but silently never returned."""
        assert set(AnnotationProperty.CLIENT_FIELDS) == set(
            AnnotationProperty().getUpdatableFields())

    def testCreateRejectsNonObjectBody(self, user, server):
        resp = server.request(
            path="/annotation_property", method="POST", user=user,
            type="application/json", body=json.dumps([PROPERTY_BODY]))
        assertStatus(resp, 400)
        assert "must be a JSON object" in resp.json["message"]

    def testUpdateRejectsNonObjectBody(self, admin, server):
        _, _, prop = createSharedProperty(admin)
        resp = server.request(
            path=f"/annotation_property/{prop['_id']}", method="PUT",
            user=admin, type="application/json",
            body=json.dumps([PROPERTY_BODY]))
        assertStatus(resp, 400)
        assert "must be a JSON object" in resp.json["message"]


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestWorkerDocumentFields:

    def testWorkerInterfaceUpdateDoesNotReturnAccess(
            self, admin, user, server):
        image = f"properties/fields_{random.random()}:latest"
        WorkerInterfaceModel().create(admin, image, {"Radius": {}})

        resp = server.request(
            path="/worker_interface", method="POST", user=user,
            params={"image": image}, type="application/json",
            body=json.dumps({"Radius": {"type": "number"}}))
        assertStatusOk(resp)
        assert "access" not in resp.json
        assert str(admin["_id"]) not in json.dumps(resp.json)
        assert resp.json["image"] == image
        assert resp.json["interface"] == {"Radius": {"type": "number"}}

    def testWorkerPreviewFindDoesNotReturnAccess(self, admin, user, server):
        image = f"properties/fields_{random.random()}:latest"
        preview = {"image": "data:image/png;base64,AAAA", "text": "hi"}
        WorkerPreviewModel().create(admin, image, preview)

        resp = server.request(
            path="/worker_preview", user=user, params={"image": image})
        assertStatusOk(resp)
        assert "access" not in resp.json
        assert str(admin["_id"]) not in json.dumps(resp.json)
        assert resp.json["preview"] == preview

        resp = server.request(
            path="/worker_preview", user=user,
            params={"image": f"{image}_missing"})
        assertStatusOk(resp)
        assert "preview" not in resp.json

    def testWorkerPreviewUpdateDoesNotReturnAccess(self, admin, server):
        image = f"properties/fields_{random.random()}:latest"
        resp = server.request(
            path="/worker_preview", method="POST", user=admin,
            params={"image": image}, type="application/json",
            body=json.dumps({"text": "hi"}))
        assertStatusOk(resp)
        assert "access" not in resp.json
        assert resp.json["preview"] == {"text": "hi"}
