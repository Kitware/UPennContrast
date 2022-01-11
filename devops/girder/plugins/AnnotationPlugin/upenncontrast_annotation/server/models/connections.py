from girder.models.model_base import AccessControlledModel
from girder.exceptions import AccessException, ValidationException
from girder.constants import AccessType
from girder import events

from bson.objectid import ObjectId
from girder.models.folder import Folder

from .annotation import Annotation

import jsonschema

class ConnectionSchema:
    tagsSchema = {
        'type': 'array',
        'items': {
            'type': 'string'
        }
    }

    connectionSchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/annotation_connection',
        'type': 'object',
        'properties': {
            'label': {'type': 'string'},
            'parentId': {'type': 'string'},
            'childId': {'type': 'string'},
            'datasetId': {'type': 'string'},
            'tags': tagsSchema
        },
        'required': ['parentId', 'childId', 'datasetId', 'tags']
    }

class AnnotationConnection(AccessControlledModel):
  # TODO: write lock
  # TODO(performance): indexing

  validator = jsonschema.Draft4Validator(
        ConnectionSchema.connectionSchema
    )

  def cleanOrphaned(self, event):
    if event.info and event.info['_id']:
      annotationId = str(event.info['_id'])
      query = {
        '$or': [
          {
            'childId': annotationId
          },
          {
            'parentId': annotationId
          }
        ]
      }
      self.removeWithQuery(query)

  def initialize(self):
    self.name="annotation_connection"
    events.bind('model.upenn_annotation.remove', 'connections.clean.orphans', self.cleanOrphaned)

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

    child = Annotation().load(document['childId'], force=True)
    if child is None:
      raise ValidationException('Child does not exist')

    parent = Annotation().load(document['parentId'], force=True)
    if parent is None:
      raise ValidationException('Parent does not exist')

    return document

  def create(self, creator, connection):
    self.setUserAccess(connection, user=creator, level=AccessType.ADMIN, save=False)
    return self.save(connection)

  def delete(self, connection):
    self.remove(self.find(connection))

  def update(self, connection):
    return self.save(connection)