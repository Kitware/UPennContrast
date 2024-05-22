from ..helpers.tasks import runJobRequest
from ..helpers.proxiedModel import ProxiedAccessControlledModel
from girder.exceptions import ValidationException, RestException
from girder.constants import AccessType
from .propertyValues import AnnotationPropertyValues as PropertiesModel
from girder import events

from bson.objectid import ObjectId

from girder.models.folder import Folder

import jsonschema


class AnnotationSchema:
    coordSchema = {
        "type": "object",
        "properties": {
            "x": {"type": "number"},
            "y": {"type": "number"},
            "z": {"type": "number"},
        },
        "name": "Coordinate",
        "description": "GeoJS point",
        "required": ["x", "y"],
    }

    coordsSchema = {"type": "array", "items": coordSchema, "minItems": 1}

    tagsSchema = {"type": "array", "items": {"type": "string"}}

    locationSchema = {
        "type": "object",
        "properties": {
            "XY": {"type": "integer"},
            "Z": {"type": "integer"},
            "Time": {"type": "integer"},
        },
    }

    shapeSchema = {"type": "string", "enum": ["point", "line", "polygon"]}

    annotationSchema = {
        "$schema": "http://json-schema.org/schema#",
        "id": "/girder/plugins/upenncontrast_annotation/models/annotation",
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
            },
            "coordinates": coordsSchema,
            "tags": tagsSchema,
            "channel": {"type": "integer"},
            "location": locationSchema,
            "shape": shapeSchema,
            "datasetId": {"type": "string", "minLength": 1},
            "color": {
                "type": "string",
            },
        },
        # color is optional
        "required": [
            "coordinates",
            "tags",
            "channel",
            "location",
            "shape",
            "datasetId",
        ],
    }


class Annotation(ProxiedAccessControlledModel):
    """
    Defines a model for storing and handling UPennContrast annotations in the
    database.
    """

    # TODO: write lock
    # TODO: save creatorId, creation and update dates
    # TODO(performance): indexing

    validator = jsonschema.Draft4Validator(AnnotationSchema.annotationSchema)

    def annotationRemovedEvent(self, event):
        if event.info and event.info["_id"]:
            annotationStringId = str(event.info["_id"])
            events.trigger(
                "model.upenn_annotation.removeStringIds", [annotationStringId]
            )

    def multipleAnnotationsRemovedEvent(self, event):
        if event.info and len(event.info) > 0:
            annotationStringIds = event.info
            events.trigger(
                "model.upenn_annotation.removeStringIds", annotationStringIds
            )

    def initialize(self):
        self.name = "upenn_annotation"
        events.bind(
            "model.folder.remove",
            "upenn.annotations.clean.orphaned",
            self.cleanOrphaned,
        )
        # Cleaning the database when annotations are removed is done by a
        # custom event: model.upenn_annotation.removeStringIds
        events.bind(
            "model.upenn_annotation.remove",
            "upenn.connections.annotationRemovedEvent",
            self.annotationRemovedEvent,
        )
        events.bind(
            "model.upenn_annotation.removeMultiple",
            "upenn.connections.multipleAnnotationsRemovedEvent",
            self.multipleAnnotationsRemovedEvent,
        )
        self.ensureIndices(["datasetId"])

    def cleanOrphaned(self, event):
        if event.info and event.info["_id"]:
            folderId = str(event.info["_id"])
            query = {
                "datasetId": folderId,
            }
            self.removeWithQuery(query)

    def validate(self, document):
        # Extract property values if they exist
        propertyValues = None
        if "properties" in document:
            propertyValues = document["properties"]
            document.pop("properties")

        # Validate using the schema
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            raise ValidationException(exp)

        # Check if the dataset exists
        folder = Folder().load(document["datasetId"], force=True)
        if folder is None:
            raise ValidationException("Dataset does not exist")
        if (
            "meta" not in folder
            or folder["meta"].get("subtype", None) != "contrastDataset"
        ):
            raise ValidationException("Folder is not a dataset")

        # Add the property values if given
        if propertyValues:
            PropertiesModel().appendValues(
                None, propertyValues, document["_id"], document["datasetId"]
            )

        return document

    def create(self, creator, annotation):
        self.setUserAccess(
            annotation, user=creator, level=AccessType.ADMIN, save=False
        )
        return self.save(annotation)

    def createMultiple(self, creator, annotations):
        for annotation in annotations:
            self.setUserAccess(
                annotation, user=creator, level=AccessType.ADMIN, save=False
            )
        return self.saveMany(annotations)

    def delete(self, annotation):
        self.remove(annotation)

    def deleteMultiple(self, annotationStringIds):
        events.trigger(
            "model.upenn_annotation.removeMultiple", annotationStringIds
        )
        query = {
            "_id": {
                "$in": [ObjectId(stringId) for stringId in annotationStringIds]
            },
        }
        self.removeWithQuery(query)

    def getAnnotationById(self, id, user=None):
        return self.load(id, user=user, level=AccessType.READ)

    def update(self, annotation):
        return self.save(annotation)

    def compute(self, datasetId, tool, user=None):
        dataset = Folder().load(datasetId, user=user, level=AccessType.WRITE)
        if not dataset:
            raise RestException(
                code=500, message="Invalid dataset id in annotation"
            )
        image = tool.get("image", None)
        if not image:
            raise RestException(
                code=500, message="Invalid segmentation tool: no image"
            )
        return runJobRequest(image, datasetId, tool, "compute")
