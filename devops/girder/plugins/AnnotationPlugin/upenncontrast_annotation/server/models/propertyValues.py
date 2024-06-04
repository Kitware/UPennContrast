from ..helpers.proxiedModel import ProxiedAccessControlledModel
from girder.constants import AccessType
from girder.exceptions import ValidationException
from girder import events

from ..helpers.fastjsonschema import customJsonSchemaCompile
import fastjsonschema


class PropertySchema:
    annotationPropertySchema = {
        "$schema": "http://json-schema.org/draft-04/schema",
        "id": "/girder/plugins/upenncontrast_annotation/models/propertyValues",
        "type": "object",
        "properties": {
            "annotationId": {
                "type": "objectId",
            },
            "datasetId": {"type": "string"},
            "values": {
                "type": "object",
                "additionalProperties": {
                    "anyOf": [
                        {
                            "type": "number",
                        },
                        {
                            "type": "object",
                            "additionalProperties": {"type": "number"},
                        },
                    ],
                },
            },
        },
        # 'additionalProperties': False
    }


class AnnotationPropertyValues(ProxiedAccessControlledModel):

    jsonValidate = staticmethod(
        customJsonSchemaCompile(PropertySchema.annotationPropertySchema)
    )

    def annotationsRemovedEvent(self, event):
        # Clean property values orphaned by the deletion of the annotations
        annotationStringIds = event.info
        query = {"annotationId": {"$in": annotationStringIds}}
        self.removeWithQuery(query)

    def initialize(self):
        self.name = "annotation_property_values"
        events.bind(
            "model.upenn_annotation.removeStringIds",
            "upenn.annotation_values.annotationsRemovedEvent",
            self.annotationsRemovedEvent,
        )

    def validate(self, document):
        return self.validateMultiple([document])[0]

    def validateMultiple(self, propertyValuesList):
        try:
            for propertyValues in propertyValuesList:
                self.jsonValidate(propertyValues)
        except fastjsonschema.JsonSchemaValueException as exp:
            raise ValidationException(exp)

        # find existing property values using the annotation id
        annotationIds = [
            propertyValues["annotationId"]
            for propertyValues in propertyValuesList
        ]
        query = {"annotationId": {"$in": annotationIds}}
        existingDocuments = {}  # indexed by annotation id
        for existingDocument in self.find(query):
            annotationId = existingDocument["annotationId"]
            existingDocuments[annotationId] = existingDocument
        # if some property values exist with the same annotation id, merge them
        if len(existingDocuments) > 0:
            for propertyValues in propertyValuesList:
                annotationId = propertyValues["annotationId"]
                existingDocument = existingDocuments.get(annotationId, None)
                if existingDocument is not None:
                    propertyValues["values"].update(existingDocument["values"])
                    propertyValues["_id"] = existingDocument["_id"]

        # TODO(performance): create sparse index on properties if nonexisting
        # https://docs.mongodb.com/manual/reference/operator/query/exists/

        return propertyValuesList

    def appendValues(self, creator, values, annotationId, datasetId):
        property_values = {
            "annotationId": annotationId,
            "values": values,
            "datasetId": datasetId,
        }
        self.setUserAccess(
            property_values, user=creator, level=AccessType.ADMIN
        )
        return self.save(property_values)

    def appendMultipleValues(self, creator, list_of_property_values):
        for property_values in list_of_property_values:
            self.setUserAccess(
                property_values, user=creator, level=AccessType.ADMIN
            )
        return self.saveMany(list_of_property_values)

    def delete(self, propertyId, datasetId):
        # Could use self.collection.updateMany but girder doesn't expose it
        for document in self.find(
            {
                "datasetId": datasetId,
                ".".join(["values", propertyId]): {"$exists": True},
            }
        ):
            document["values"].pop(propertyId, None)
            if len(document["values"]) == 0:
                self.remove(document)
            else:
                self.save(document, False)

    def histogram(self, propertyPath, datasetId, buckets=255):
        valueKey = "values." + propertyPath
        match = {
            "$match": {
                "datasetId": datasetId,
                # TODO(performance): sparse index see above
                valueKey: {"$exists": True, "$ne": None},
            }
        }

        bucket = {
            "$bucketAuto": {"groupBy": "$" + valueKey, "buckets": buckets}
        }

        project = {
            "$project": {
                "_id": False,
                "min": "$_id.min",
                "max": "$_id.max",
                "count": True,
            }
        }

        return self.collection.aggregate([match, bucket, project])

    # def SSE for property change, sends the whole annotation
