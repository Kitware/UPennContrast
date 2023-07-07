from girder.api import access
from girder.api.describe import Description, describeRoute
from girder.api.rest import Resource
from girder.exceptions import AccessException, RestException
from ..models.history import History as HistoryModel
from bson.objectid import ObjectId

class History(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = 'history'

        self._historyModel: HistoryModel = HistoryModel()

        self.route('GET', (), self.find)
        self.route('PUT', ('undo',), self.undo)
        self.route('PUT', ('redo',), self.redo)

    @access.user
    @describeRoute(Description("Get last history actions for the user, from the most recent to the oldest")
                   .param('datasetId', 'The dataset in which are the history entries', required=True))
    def find(self, params):
        user = self.getCurrentUser()
        if user is None:
            raise AccessException('You must be logged in.')
        if 'datasetId' not in params:
            raise RestException(code=400, message='Dataset ID is missing')
        datasetId = ObjectId(params['datasetId'])
        return self._historyModel.getLastEntries(user, datasetId)

    @access.user
    @describeRoute(Description("Undo the last history entry which hasn't been undone")
                   .param('datasetId', 'The dataset in which undo should be done', required=True))
    def undo(self, params):
        user = self.getCurrentUser()
        if user is None:
            raise AccessException('You must be logged in.')
        if 'datasetId' not in params:
            raise RestException(code=400, message='Dataset ID is missing')
        datasetId = ObjectId(params['datasetId'])
        return self._historyModel.undo(user, datasetId)

    @access.user
    @describeRoute(Description("Redo the last history entry which has been undone")
                   .param('datasetId', 'The dataset in which redo should be done', required=True))
    def redo(self, params):
        user = self.getCurrentUser()
        if user is None:
            raise AccessException('You must be logged in.')
        if 'datasetId' not in params:
            raise RestException(code=400, message='Dataset ID is missing')
        datasetId = ObjectId(params['datasetId'])
        self._historyModel.redo(user, datasetId)
