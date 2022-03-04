from girder.models.model_base import AccessControlledModel
from girder.exceptions import AccessException, ValidationException, RestException
from girder.constants import AccessType
from ..helpers.tasks import runComputeJob

from bson.objectid import ObjectId
import jsonschema


from girder.models.folder import Folder


class PreviewSchema:
    previewSchema = {
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
            'preview': {
                'type': 'object',
                'properties': {
                    'image': {
                        'type': 'string'
                    },
                    'preview': {
                        'type': 'object'
                    }
                }
            }
        },
        # 'additionalProperties': False
    }


class WorkerPreviewModel(AccessControlledModel):

    validator = jsonschema.Draft4Validator(
        PreviewSchema.previewSchema
    )

    def initialize(self):
        self.name = "worker_preview"

    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            raise ValidationException(exp)
        return document

    def create(self, creator, image, preview):
        created = {'image': image, 'preview': preview}
        self.setUserAccess(created, user=creator,
                           level=AccessType.ADMIN, save=False)
        return self.save(created)

    def delete(self, image):
        self.remove(self.getImagePreview(image))

    def update(self, creator, image, preview):
        existing = self.getImagePreview(image)
        if existing is None:
            return self.create(creator, image, preview)
        existing['preview'] = preview
        return self.save(existing)

    def getImagePreview(self, image):
        query = {'image': image}
        return self.findOne(query)

    def requestPreviewUpdate(self, image, datasetId, parameters, user):
        dataset = Folder().load(datasetId, user=user, level=AccessType.WRITE)
        if not dataset:
            raise RestException(
                code=500, message="Invalid dataset id in annotation")

        parameters['request'] = 'preview'
        return runComputeJob(image, datasetId, parameters)
