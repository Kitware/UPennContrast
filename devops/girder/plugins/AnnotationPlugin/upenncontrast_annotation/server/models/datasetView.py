from girder.constants import AccessType
from girder.exceptions import ValidationException
from ..helpers.proxiedModel import ProxiedAccessControlledModel

import jsonschema

class DatasetViewSchema:
    contrastSchema = {
        'type': 'object',
        'properties': {
            'mode': {
                'type': 'string',
                'enum': ['percentile', 'absolute']
            },
            'blackPoint': {
                'type': 'number'
            },
            'whitePoint': {
                'type': 'number'
            }
        }
    }
    datasetViewSchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/datasetView',
        'type': 'object',
        'properties': {
            'datasetId': {
                'type': 'string'
            },
            'configurationId': {
                'type': 'string'
            },
            # Associate a contrast to a layer id
            'layerContrasts': {
                'type': 'object',
                'additionalProperties': contrastSchema
            }
        },
        'required': ['datasetId', 'configurationId', 'layerContrasts']
    }

class DatasetView(ProxiedAccessControlledModel):
    validator = jsonschema.Draft4Validator(
        DatasetViewSchema.datasetViewSchema
    )

    def initialize(self):
        self.name = "dataset_view"

    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            print('not validated cause objectId')
            raise ValidationException(exp)
        return document
    
    def create(self, creator, dataset_view):
      self.setUserAccess(dataset_view, user=creator, level=AccessType.ADMIN, save=False)
      return self.save(dataset_view)
    
    def delete(self, dataset_view):
      self.remove(dataset_view)

    def update(self, dataset_view, new_dataset_view):
      id = dataset_view['_id']
      dataset_view.update(new_dataset_view)
      dataset_view['_id'] = id
      return self.save(dataset_view)
