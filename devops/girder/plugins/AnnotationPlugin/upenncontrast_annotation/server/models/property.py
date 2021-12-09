from girder.models.model_base import AccessControlledModel
from girder.exceptions import AccessException, ValidationException
from girder.constants import AccessType
from ..helpers.tasks import runComputeJob

from bson.objectid import ObjectId
import jsonschema


class PropertySchema:
    propertySchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/annotation',
        'type': 'object',
        'properties': {
            'name': { # should be unique TODO: enforce
                'type': 'string'
            },
            'image': {
                'type': 'string'
            },
            'propertyType': {
                'type': 'string',
                'enum': ['layer', 'morphology', 'relational']
            },
            'parameters': {
                'type': 'object',
                'properties': {
                    'layer': {
                        'type': 'integer'
                    },
                    'tags': { # TODO:
                        'type': 'object',
                        'properties': {
                            'tags': {
                                'type': 'array'
                            },
                            'exclusive': {
                                'type': 'boolean'
                            }
                        }
                    },
                    'independant': {
                        'type': 'boolean'
                    },
                    'shape': { # TODO: deduplicate
                        'type': 'string',
                        'enum': ['point', 'line', 'polygon']
                    },
                }
            }
        },
        # 'additionalProperties': False
    }


class AnnotationProperty(AccessControlledModel):
    # TODO: delete hooks: remove all computed values if the property is deleted ? (big operation)

    validator = jsonschema.Draft4Validator(
        PropertySchema.propertySchema
    )

    def initialize(self):
        self.name = "annotation_property"

    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            print('not validated cause objectId')
            raise ValidationException(exp)
        return document

    def create(self, creator, property):
      self.setUserAccess(property, user=creator, level=AccessType.ADMIN, save=False)
      return self.save(property)

    def delete(self, property):
      self.remove(self.find(property))
    
    def update(self, property):
      return self.save(property)

    def getPropertyById(self, id):
      return self.load(id)

    def compute(self, propertyId, datasetId, params):
        # TODO: validate params from property
        # TODO: validate dataset existence, has at least one annotation
        query = { 'name': propertyId }
        property = self.findOne(query)

        if property:
            return runComputeJob(property, datasetId, params)
        return {}
