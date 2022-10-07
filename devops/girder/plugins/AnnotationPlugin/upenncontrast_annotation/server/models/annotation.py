from ..helpers.tasks import runComputeJob
from girder.models.model_base import AccessControlledModel
from girder.exceptions import AccessException, ValidationException, RestException
from girder.constants import AccessType
from .propertyValues import AnnotationPropertyValues as PropertiesModel
from girder import events, logprint, logger, auditLogger

from bson.objectid import ObjectId

from girder.models.folder import Folder

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
        'required': ['coordinates', 'tags', 'channel', 'location', 'shape', 'datasetId']
    }

class Annotation(AccessControlledModel):
  '''
    Defines a model for storing and handling UPennContrast annotations in the database.
  '''
  # TODO: write lock
  # TODO: save creatorId, creation and update dates
  # TODO(performance): indexing

  validator = jsonschema.Draft4Validator(
        AnnotationSchema.annotationSchema
    )

  def initialize(self):
    self.name="upenn_annotation"
    events.bind('model.folder.remove', 'upenn.annotations.clean.orphaned', self.cleanOrphaned)

  def cleanOrphaned(self, event):
    if event.info and event.info['_id']:
      folderId = str(event.info['_id'])
      query = {
        "datasetId": folderId,
      }
      self.removeWithQuery(query)

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

    folder = Folder().load(document['datasetId'], force=True)
    if folder is None:
      raise ValidationException('Dataset does not exist')
    if 'meta' not in folder or folder['meta'].get('subtype', None) != 'contrastDataset':
      raise ValidationException('Folder is not a dataset')

    return document

  def create(self, creator, annotation):
    self.setUserAccess(annotation, user=creator, level=AccessType.ADMIN, save=False)
    return self.save(annotation)

  def delete(self, annotation):
    self.remove(self.find(annotation))

  def getAnnotationById(self, id, user=None):
    return self.load(id, user=user, level=AccessType.READ)

  def update(self, annotation):
    return self.save(annotation)

  def compute(self, datasetId, tool, user=None):
    dataset = Folder().load(datasetId, user=user, level=AccessType.WRITE)
    if not dataset:
        raise RestException(code=500, message="Invalid dataset id in annotation")
    image = tool.get('image', None)
    if not image:
        raise RestException(code=500, message="Invalid segmentation tool: no image")
    return runComputeJob(image, datasetId, tool)

  def createMultiple(self, creator, annotations):
    return [self.create(creator=creator, annotation=annotation) for annotation in annotations]
