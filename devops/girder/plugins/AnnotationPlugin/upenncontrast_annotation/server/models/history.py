from girder.constants import SortDir, AccessType
from girder.exceptions import ValidationException
from girder.models.model_base import AccessControlledModel
from girder.utility.model_importer import ModelImporter

from bson.objectid import ObjectId
import datetime
import jsonschema

class HistorySchema:
    # Example of recordSchema (recording an addition and a deletion of annotation):
    # {
    #     "annotations": {
    #         "63d7fccbbb2c4fdb6eb1b0e8": { "before": None, "after": { "shape": "point", "channel": 0, ... } },
    #         "63d7fdf7bb2c4fdb6eb1b0f4": { "before": { "shape": "polygon", "channel": 1, ... }, "after": None },
    #     },
    # }
    recordSchema = {
        # Record per model, keys are model names
        'type': 'object',
        'additionalProperties': {
            # Changes per document, keys are stringified document ids (not ObjectIds)
            'type': 'object',
            'additionalProperties': {
                'type': 'object',
                'properties': {
                    # Document before action, can be None, keys are document ids
                    'before': {
                        'type': ['object', 'null'],
                    },
                    # Document after action, can be None, keys are document ids
                    'after': {
                        'type': ['object', 'null'],
                    },
                },
                'required': ['before', 'after'],
            },
        },
    }

    historySchema = {
        '$schema': 'http://json-schema.org/schema#',
        'id': '/girder/plugins/upenncontrast_annotation/models/history',
        'type': 'object',
        'properties': {
            'actionName': {
                'type': 'string',
            },
            'record': recordSchema,
            # https://pymongo.readthedocs.io/en/stable/examples/datetimes.html
            'actionDate': {
                # Special type defined in a custom validator
                'type': 'datetime',
            },
            'userId': {
                # Special type defined in a custom validator
                'type': 'objectId',
            },
            'isUndone': {
                'type': 'boolean',
            },
        },
        'required': ['actionName', 'record', 'actionDate', 'userId', 'isUndone']
    }

class History(AccessControlledModel):
    '''
    Register actions on some endpoints using the ProxiedAccessControlledModel
    This class itself doesn't inherit the ProxiedAccessControlledModel
    '''

    BaseValidator = jsonschema.Draft4Validator

    # Build a new type checker
    # https://python-jsonschema.readthedocs.io/en/latest/validate/#type-checking
    def is_datetime(checker, inst):
        return isinstance(inst, datetime.datetime)
    def is_objectId(checker, inst):
        return isinstance(inst, ObjectId) and ObjectId.is_valid(inst)
    date_check = BaseValidator.TYPE_CHECKER.redefine('datetime', is_datetime).redefine('objectId', is_objectId)

    # Build a validator with the new type checker
    # https://python-jsonschema.readthedocs.io/en/latest/creating/
    CustomDraft4Validator = jsonschema.validators.extend(BaseValidator, type_checker=date_check)
    validator = CustomDraft4Validator(HistorySchema.historySchema)

    @staticmethod
    def now():
        return datetime.datetime.now(tz=datetime.timezone.utc)

    def initialize(self):
        self.name = "history"

    def validate(self, document):
        try:
            self.validator.validate(document)
        except jsonschema.ValidationError as exp:
            print('Validation of an history document failed')
            raise ValidationException(exp)
        return document

    def getLastEntries(self, user):
        """
        Get the history entries for this user, sorted by descending actionDate
        Only return some fields from the model, as the record can be heavy and the userId is useless
        """
        query = { 'userId': user['_id'] }
        sort = [('actionDate', SortDir.DESCENDING)]
        fields = { '_id': 0, 'actionName': 1, 'actionDate': 1, 'isUndone': 1 }
        return self.findWithPermissions(query, sort=sort, fields=fields, user=user)

    def undo(self, user):
        self.undoOrRedo(user, True)

    def redo(self, user):
        self.undoOrRedo(user, False)

    def undoOrRedo(self, user, undo: bool):
        # Get the most recent action which has (not) been undone
        query = { 'userId': user['_id'], 'isUndone': not undo }
        sort = [('actionDate', SortDir.DESCENDING if undo else SortDir.ASCENDING)]
        history_entry = next(self.findWithPermissions(query, sort=sort, user=user, level=AccessType.WRITE, limit=1), None)
        if history_entry is None:
            return

        # Undo or redo the action
        change_key = 'before' if undo else 'after'
        record_per_model = history_entry['record']
        for model_name in record_per_model:
            model: AccessControlledModel = ModelImporter.model(model_name, 'upenncontrast_annotation')
            record_per_document = record_per_model[model_name]
            for string_document_id in record_per_document:
                change = record_per_document[string_document_id]
                replacement = change[change_key]
                if replacement is None:
                    model.collection.delete_one({ '_id': ObjectId(string_document_id) })
                else:
                    model.collection.replace_one({ '_id': ObjectId(string_document_id) }, replacement, upsert=True)

        # Update the entry
        history_entry['isUndone'] = undo
        return self.save(history_entry)

    def create(self, creator, entry):
        # Remove history entries older than 1 hour
        limit_date = History.now() - datetime.timedelta(hours=1)
        self.removeWithQuery({ 'actionDate': { '$lt': limit_date } })

        # Remove history entries that have been undone
        self.removeWithQuery({ 'userId': creator['_id'], 'isUndone': True })

        # Cap the number of entries per user
        limit_cap = 10
        docs_to_remove = self.find({ 'userId': creator['_id'] }, sort=[('actionDate', SortDir.DESCENDING)], offset=limit_cap-1, fields={ '_id': 1 })
        ids_to_remove = [doc['_id'] for doc in docs_to_remove]
        if len(ids_to_remove) > 0:
            self.removeWithQuery({ '_id': { '$in': ids_to_remove } })

        self.setUserAccess(entry, user=creator, level=AccessType.ADMIN, save=False)
        return self.save(entry)
