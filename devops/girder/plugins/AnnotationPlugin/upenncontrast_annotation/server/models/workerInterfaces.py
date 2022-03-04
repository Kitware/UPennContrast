from girder.models.model_base import AccessControlledModel
from girder.exceptions import ValidationException
from girder.constants import AccessType
from ..helpers.tasks import runComputeJob

import jsonschema


class InterfaceSchema:
    interfaceSchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/annotation',
        'type': 'object',
        'properties': {
            'name': {
                'type': 'string'
            },
            'image': {
                'type': 'string'
            },
            'parameters': {
                'type': 'object',
                'properties': {
                    'image': {
                        'type': 'string'
                    },
                    'interface': {
                        'type': 'object'
                    }
                }
            }
        },
        # 'additionalProperties': False
    }


class WorkerInterfaceModel(AccessControlledModel):

    validator = jsonschema.Draft4Validator(
        InterfaceSchema.interfaceSchema
    )

    def initialize(self):
        self.name = "worker_interface"

    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            raise ValidationException(exp)
        return document

    def create(self, creator, image, interface):
        created = {'image': image, 'interface': interface}
        self.setUserAccess(created, user=creator,
                           level=AccessType.ADMIN, save=False)
        return self.save(created)

    def delete(self, interface):
        self.remove(self.find(interface))

    def update(self, creator, image, interface):
        existing = self.getImageInterface(image)
        if existing is None:
            return self.create(creator, image, interface)
        existing['interface'] = interface
        return self.save(existing)

    def getImageInterface(self, image):
        query = {'image': image}
        return self.findOne(query)

    def requestWorkerUpdate(self, image):
        return runComputeJob(image, None, {'request': 'interface', 'image': image})
