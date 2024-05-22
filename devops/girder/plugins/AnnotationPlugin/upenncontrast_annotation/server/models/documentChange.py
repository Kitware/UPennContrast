from girder.constants import AccessType
from girder.exceptions import ValidationException

from helpers.customModel import CustomAccessControlledModel

from bson.objectid import ObjectId
import jsonschema

class DocumentChangeSchema:
    documentChangeSchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/documentChange',
        'type': 'object',
        'properties': {
            'historyId': {
                # Special type defined in a custom validator
                'type': 'objectId',
            },
            'modelName': {
                'type': 'string',
            },
            'documentId': {
                'type': 'objectId',
            },
            # Document before action, can be None
            'before': {
                'type': ['object', 'null'],
            },
            # Document after action, can be None
            'after': {
                'type': ['object', 'null'],
            },
        },
        'required': ['historyId', 'modelName', 'before', 'after'],
    }

class DocumentChange(CustomAccessControlledModel):
    '''
    Register actions on some endpoints using the ProxiedAccessControlledModel
    This class itself doesn't inherit the ProxiedAccessControlledModel
    '''

    BaseValidator = jsonschema.Draft4Validator

    # Build a new type checker
    # https://python-jsonschema.readthedocs.io/en/latest/validate/#type-checking
    def is_objectId(checker, inst):
        return isinstance(inst, ObjectId) and ObjectId.is_valid(inst)
    date_check = BaseValidator.TYPE_CHECKER.redefine('objectId', is_objectId)

    # Build a validator with the new type checker
    # https://python-jsonschema.readthedocs.io/en/latest/creating/
    CustomDraft4Validator = jsonschema.validators.extend(BaseValidator, type_checker=date_check)
    validator = CustomDraft4Validator(DocumentChangeSchema.documentChangeSchema)

    def initialize(self):
        self.name = 'document_change'
    
    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            print('Validation of an history document failed')
            raise ValidationException(exp)
        return document

    def createChangesFromRecord(self, history_id, record, creator):
        # The record is a dict { model_name: { document_id: { before: ..., after: ... } } }
        for model_name in record:
            for document_id in record[model_name]:
                raw_change = record[model_name][document_id]
                new_document_change = {
                    'historyId': history_id,
                    'modelName': model_name,
                    'documentId': ObjectId(document_id),
                    'before': raw_change['before'],
                    'after': raw_change['after'],
                }
                self.setUserAccess(new_document_change, user=creator, level=AccessType.ADMIN)
                self.save(new_document_change)
