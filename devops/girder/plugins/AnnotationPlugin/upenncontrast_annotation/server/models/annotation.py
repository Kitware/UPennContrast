from girder.models.model_base import AccessControlledModel
from girder.exceptions import AccessException, ValidationException
from girder.constants import AccessType
from .propertyValues import AnnotationPropertyValues as PropertiesModel
from girder import events, logprint, logger, auditLogger

from bson.objectid import ObjectId
import jsonschema

class AnnotationSchema:
    coordSchema = {
        'type': 'object',
        'properties': {
            'x': {
                'type': 'number'
            },
            'y': {'type': 'number'},
            'z': {'type': 'number'}
        },
        'name': 'Coordinate',
        'description': 'GeoJS point',
        'required': ['x', 'y']
    }

    coordsSchema = {
        'type': 'array',
        'items': coordSchema,
        'minItems': 1
    }

    tagsSchema = {
        'type': 'array',
        'items': {
            'type': 'string'
        }
    }

    locationSchema = {
        'type': 'object',
        'properties': {
            'XY': {'type': 'integer'},
            'Z': {'type': 'integer'},
            'Time': {'type': 'integer'}
        }
    }

    shapeSchema = {
        'type': 'string',
        'enum': ['point', 'line', 'polygon']
    }

    annotationSchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/annotation',
        'type': 'object',
        'properties': {
            'name': {
                'type': 'string',
            },
            'coordinates': coordsSchema,
            'tags': tagsSchema,
            'channel': {'type': 'integer'},
            'location': locationSchema,
            'shape': shapeSchema,
            'datasetId': {'type': 'string', 'minLength': 1},
        },
    }

class Annotation(AccessControlledModel):
  '''
    Defines a model for storing and handling UPennContrast annotations in the database.
  '''
  # TODO: write lock
  # TODO: save creatorId, creation and update dates
  # TODO: indexing
  # TODO: add remove hooks to also remove related connections
  # TODO: smarter find methods
  # TODO: schema endpoint

  validator = jsonschema.Draft4Validator(
        AnnotationSchema.annotationSchema
    )

  def initialize(self):
    self.name="upenn_annotation"

  def save(self, document, validate=True, triggerEvents=True):
    '''
      Save a document in the database.
      Behaves the same as AccessControlledModel, but will look for a 'properties' field, apply the found property values then remove the field.
    '''
    propertyValues = None
    if 'properties' in document:
      propertyValues = document['properties']
      document.pop('properties')
    document = super().save(document, validate, triggerEvents)

    if propertyValues:
      PropertiesModel().appendValues(None, propertyValues, document['_id'], document['datasetId'])

    return document


  def validate(self, document):
    try:
      self.validator.validate(document)
    except jsonschema.ValidationError as exp:
      raise ValidationException(exp)

    return document

  def create(self, creator, annotation):
    self.setUserAccess(annotation, user=creator, level=AccessType.ADMIN, save=False)
    return self.save(annotation)

  def delete(self, annotation):
    self.remove(self.find(annotation))

  def getAnnotationById(self, id):
    return self.load(id)

  def update(self, annotation):
    return self.save(annotation)