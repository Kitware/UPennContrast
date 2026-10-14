import time

from girder.constants import AccessType
from girder.exceptions import ValidationException
from ..helpers.proxiedModel import ProxiedModel

from ..helpers.fastjsonschema import customJsonSchemaCompile
import fastjsonschema


class DatasetViewSchema:
    contrastSchema = {
        "type": "object",
        "properties": {
            "mode": {"type": "string", "enum": ["percentile", "absolute"]},
            "blackPoint": {"type": "number"},
            "whitePoint": {"type": "number"},
        },
    }

    locationSchema = {
        "type": "object",
        "properties": {
            "xy": {
                "type": "number",
            },
            "z": {
                "type": "number",
            },
            "time": {
                "type": "number",
            },
        },
        "required": ["xy", "z", "time"],
        "additionalProperties": False,
    }

    datasetViewSchema = {
        "$schema": "http://json-schema.org/draft-04/schema",
        "id": "/girder/plugins/upenncontrast_annotation/models/datasetView",
        "type": "object",
        "properties": {
            "datasetId": {"type": "objectId"},
            "configurationId": {"type": "objectId"},
            "lastLocation": locationSchema,
            # Associate a contrast to a layer id
            "layerContrasts": {
                "type": "object",
                "additionalProperties": contrastSchema,
            },
            # Per-user scale overrides and last-opened time (epoch ms),
            # written by the client on every view save. Listed so update's
            # allowlist keeps them; null stays valid because older views
            # may hold it, and saves outside create/update (setPublic,
            # setUserAccess) validate the stored document as it is.
            "scales": {"type": ["object", "null"]},
            "lastViewed": {"type": ["number", "null"]},
        },
        "required": [
            "datasetId",
            "configurationId",
            "layerContrasts",
            "lastLocation",
        ],
    }


class DatasetView(ProxiedModel):

    def __init__(self):
        super().__init__()
        self.ensureIndices(["datasetId", "configurationId"])

    jsonValidate = staticmethod(
        customJsonSchemaCompile(DatasetViewSchema.datasetViewSchema)
    )

    def initialize(self):
        self.name = "dataset_view"
        self.schema = DatasetViewSchema.datasetViewSchema
        # filter() exposes only these. Views are shared with collaborators
        # and share-link users, and the `access` ACL names all of them.
        self.exposeFields(AccessType.READ, (
            "_id", "datasetId", "configurationId", "layerContrasts",
            "lastLocation", "scales", "lastViewed", "public",
        ))

    def validate(self, document):
        try:
            self.jsonValidate(document)
        except fastjsonschema.JsonSchemaValueException as exp:
            print("not validated cause objectId")
            raise ValidationException(exp)
        return document

    @staticmethod
    def _ensureLastViewed(dataset_view):
        # The app stamps lastViewed (ms since epoch, like Date.now()) on the
        # views it creates; views from the REST API or the multi_source
        # endpoint (nimbusimage ds.configure()) would otherwise have none,
        # sort last in the recent list, and show no date there. null counts
        # as missing (the schema allows it for older views).
        if dataset_view.get("lastViewed") is None:
            dataset_view["lastViewed"] = int(time.time() * 1000)

    def create(self, creator, dataset_view):
        self._ensureLastViewed(dataset_view)
        self.setUserAccess(
            dataset_view, user=creator, level=AccessType.ADMIN, save=False
        )
        return self.save(dataset_view)

    def delete(self, dataset_view):
        self.remove(dataset_view)

    def updateDatasetView(self, dataset_view, new_dataset_view):
        id = dataset_view["_id"]
        dataset_view.update(new_dataset_view)
        dataset_view["_id"] = id
        # POST onto an existing pair lands here instead of create(), as can a
        # view stored before create() defaulted lastViewed.
        self._ensureLastViewed(dataset_view)
        return self.save(dataset_view)
