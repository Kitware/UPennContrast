from ..helpers.proxiedModel import ProxiedAccessControlledModel
from girder.exceptions import ValidationException, RestException
from girder.constants import AccessType
from ..helpers.tasks import runJobRequest

import jsonschema


class PropertySchema:
    propertySchema = {
        "$schema": "http://json-schema.org/schema#",
        "id": "/girder/plugins/upenncontrast_annotation/models/property",
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "image": {"type": "string"},
            "tags": {
                "type": "object",
                "properties": {
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "exclusive": {"type": "boolean"},
                },
            },
            "shape": {"type": "string", "enum": ["point", "line", "polygon"]},
            "workerInterface": {"type": "object"},
        },
    }


class AnnotationProperty(ProxiedAccessControlledModel):
    # TODO: write lock
    # TODO: delete hooks: remove all computed values if the property is
    #   deleted ? (big operation)

    validator = jsonschema.Draft4Validator(PropertySchema.propertySchema)

    def initialize(self):
        self.name = "annotation_property"

    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            print("not validated cause objectId")
            raise ValidationException(exp)
        return document

    def create(self, creator, property):
        self.setUserAccess(
            property, user=creator, level=AccessType.ADMIN, save=False
        )
        return self.save(property)

    def delete(self, property):
        self.remove(property)

    def update(self, property):
        return self.save(property)

    def getPropertyById(self, id, user=None):
        return self.load(id, user=user)

    def compute(self, property, datasetId, params):
        image = property.get("image", None)
        if not image:
            raise RestException(code=500, message="Invalid property: no image")

        if property:
            return runJobRequest(image, datasetId, params, "compute")
        return {}
