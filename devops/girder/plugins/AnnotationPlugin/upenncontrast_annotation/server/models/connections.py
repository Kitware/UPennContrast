from girder.models.model_base import AccessControlledModel
from girder.exceptions import AccessException, ValidationException
from girder.constants import AccessType

from bson.objectid import ObjectId
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
    }

class AnnotationConnection(AccessControlledModel):
  # TODO: write lock
  # TODO: indexing

  validator = jsonschema.Draft4Validator(
        ConnectionSchema.connectionSchema
    )

  def initialize(self):
    self.name="annotation_connection"

  def validate(self, document):
    try:
      self.validator.validate(document)
    except jsonschema.ValidationError as exp:
        raise ValidationException(exp)
    return document

  def create(self, creator, connection):
    self.setUserAccess(connection, user=creator, level=AccessType.ADMIN, save=False)
    return self.save(connection)

  def delete(self, connection):
    self.remove(self.find(connection))

  def update(self, connection):
    return self.save(connection)