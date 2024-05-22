from ..helpers.proxiedModel import ProxiedAccessControlledModel
from girder.constants import AccessType
from girder.exceptions import ValidationException
from girder import events

import jsonschema


class PropertySchema:
    annotationPropertySchema = {
        "$schema": "http://json-schema.org/schema#",
        "id": "/girder/plugins/upenncontrast_annotation/models/propertyValues",
        "type": "object",
        "properties": {
            "annotationId": {
                "bsonType": "objectId",
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
                            "additionalProperties": "number",
                        },
                    ],
                },
            },
        },
        # 'additionalProperties': False
    }


class AnnotationPropertyValues(ProxiedAccessControlledModel):
    validator = jsonschema.Draft4Validator(
        PropertySchema.annotationPropertySchema
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
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            raise ValidationException(exp)

        # find existing property values for the annotation id
        annotationId = document["annotationId"]
        query = {"annotationId": annotationId}
        existingProperties = self.findOne(query)

        # keep existing values
        if existingProperties:
            existingValues = existingProperties["values"]
            existingValues.update(document["values"])
            document["values"] = existingValues
            self.remove(existingProperties)

        # TODO(performance): create sparse index on properties if nonexisting
        # https://docs.mongodb.com/manual/reference/operator/query/exists/

        return document

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
