from girder.models.model_base import AccessControlledModel
from girder.exceptions import ValidationException

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
            },
            'savedBlackPoint': {
                'type': 'number'
            },
            'savedWhitePoint': {
                'type': 'number'
            }
        }
    }
    datasetViewSchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/annotation',
        'type': 'object',
        'properties': {
            'name': {
                'type': 'string'
            },
            'datasetId': {
                'type': 'string'
            },
            'configurationId': {
                'type': 'string'
            },
            'layerContrasts': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'layerId': {
                            'type': 'string'
                        },
                        'constrast': contrastSchema
                    }
                }
            }
        }
    }

class DatasetView(AccessControlledModel):
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
