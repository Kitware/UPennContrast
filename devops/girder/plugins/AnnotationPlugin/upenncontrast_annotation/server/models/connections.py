from ..helpers.proxiedModel import ProxiedAccessControlledModel
from girder.exceptions import ValidationException
from girder.constants import AccessType
from girder import events

from bson.objectid import ObjectId
from girder.models.folder import Folder

from .annotation import Annotation
from ..helpers.connections import annotationToAnnotationDistance

import jsonschema
import math
import numpy as np

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

class AnnotationConnection(ProxiedAccessControlledModel):
  # TODO: write lock
  # TODO(performance): indexing

  validator = jsonschema.Draft4Validator(
        ConnectionSchema.connectionSchema
    )

  def annotationsRemovedEvent(self, event):
    # Clean connections orphaned by the deletion of the annotations
    annotationStringIds = event.info
    query = {
      '$or': [
        {
          'childId': { '$in': annotationStringIds }
        },
        {
          'parentId': { '$in': annotationStringIds }
        }
      ]
    }
    self.removeWithQuery(query)

  def folderRemovedEvent(self, event):
    if event.info and event.info['_id']:
      folderId = str(event.info['_id'])
      query = {
        "datasetId": folderId,
      }
      self.removeWithQuery(query)

  def initialize(self):
    self.name="annotation_connection"
    events.bind('model.upenn_annotation.removeStringIds', 'upenn.connections.annotationsRemovedEvent', self.annotationsRemovedEvent)
    events.bind('model.folder.remove', 'upenn.connections.folderRemovedEvent', self.folderRemovedEvent)

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

  def deleteMultiple(self, connectionStringIds):
    query = {
      '_id': { '$in': [ObjectId(stringId) for stringId in connectionStringIds] },
    }
    return self.removeWithQuery(query)

  def update(self, connection):
    return self.save(connection)
  
  def getClosestAnnotation(self, annotationRef, annotations):
    """Get the closest annotation based on its distance to a reference annotation.

    Args:
        annotationRef (any): the annotation of reference
        annotations (any): a list of annotations

    Returns:
        Tuple(Annotation, Number): Returns a tuple of 2 items: the closest annotation and the minimum distance
        None: if no closest annotation is found
    """
    
    filteredAnnotations = [annotation for annotation in annotations if annotation["_id"] != annotationRef["_id"]]
    if len(filteredAnnotations) == 0:
      return None
    distances = np.array([annotationToAnnotationDistance(annotationRef, annotation) for annotation in filteredAnnotations])
    closestAnnotationIdx = np.argmin(distances)
    return (filteredAnnotations[closestAnnotationIdx], distances[closestAnnotationIdx])
    
  def connectToNearest(self, info, user=None):
    # annotation ids, a list of tags and a channel index.
    connections = []

    annotationsIdsToConnect = info['annotationsIds']
    ids = [ObjectId(id) for id in annotationsIdsToConnect]
  
    # Get annotations that match selected tags and channel
    query = {
      "_id": {"$nin": ids},
    }
    # channelId can be None if not specify
    channelId = info["channelId"]
    channelQuery = {"channel": int(channelId)} if channelId is not None else {}
    query.update(channelQuery)

    tags = info["tags"]
    tagsQuery = {"tags": {  "$in": tags }} if tags is not None and len(tags) > 0 else {}
    query.update(tagsQuery)

    # Loop on each annotation to connect
    # Look for the closest annotation and connect to it
    for id in ids:
      annotation = Annotation().getAnnotationById(id, user)

      if annotation is None:
        print("Annotation not defined", id)
        continue

      # Only work on annotations that are placed in the same tile
      location = annotation["location"]
      tileQuery = {
        "location": location
      }
      query.update(tileQuery)

      # Only work on annotations that are placed in the same dataset
      datasetId = annotation["datasetId"]
      datasetQuery = {
        "datasetId": datasetId
      }
      query.update(datasetQuery)

      annotations = list(Annotation().find(query))

      # Find the closest annotation
      result = self.getClosestAnnotation(annotation, annotations)
      
      # Define connection
      if result is not None:
        connections.append(self.create(creator=user, connection={
          "tags": [],
          "label": "A Connection -- automatic",
          "parentId": str(result[0]['_id']),
          "childId": str(id),
          "datasetId": annotation["datasetId"]
        }))

    return connections
