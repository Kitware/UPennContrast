"""lastViewed defaulting on dataset view creation.

The app stamps lastViewed on the views it creates; a view created any other
way (REST API, the multi_source endpoint behind nimbusimage ds.configure())
must still get one, or it shows no date in the Recent Datasets list.
"""
import json
import time

import pytest

from pytest_girder.assertions import assertStatusOk

from upenncontrast_annotation.server.models.collection import Collection

from . import girder_utilities as utilities
from . import upenn_testing_utilities as upenn_utilities


def _createDatasetAndConfig(user):
    dataset = utilities.createFolder(
        user, "last_viewed_dataset", upenn_utilities.datasetMetadata
    )
    config = Collection().createCollection(
        name="last_viewed_config",
        creator=user,
        folder=dataset,
        metadata={
            "subtype": "contrastDataset",
            "compatibility": {},
            "layers": [],
            "tools": [],
            "propertyIds": [],
            "snapshots": [],
            "scales": {},
        },
        description="",
    )
    return dataset, config


def _postView(server, user, body):
    resp = server.request(
        path="/dataset_view",
        method="POST",
        user=user,
        body=json.dumps(body),
        type="application/json",
    )
    assertStatusOk(resp)
    return resp.json


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestDatasetViewLastViewed:
    def testCreateWithoutLastViewedDefaultsToNow(self, server, admin):
        dataset, config = _createDatasetAndConfig(admin)
        before = int(time.time() * 1000)
        view = _postView(server, admin, {
            "datasetId": str(dataset["_id"]),
            "configurationId": str(config["_id"]),
            "layerContrasts": {},
            "lastLocation": {"xy": 0, "z": 0, "time": 0},
        })
        after = int(time.time() * 1000)
        # Milliseconds since epoch, like the app's Date.now().
        assert before <= view["lastViewed"] <= after

    def testCreateKeepsAProvidedLastViewed(self, server, admin):
        dataset, config = _createDatasetAndConfig(admin)
        view = _postView(server, admin, {
            "datasetId": str(dataset["_id"]),
            "configurationId": str(config["_id"]),
            "layerContrasts": {},
            "lastLocation": {"xy": 0, "z": 0, "time": 0},
            "lastViewed": 1700000000000,
        })
        assert view["lastViewed"] == 1700000000000
