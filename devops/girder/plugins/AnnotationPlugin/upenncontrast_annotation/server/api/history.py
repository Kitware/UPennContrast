from girder.api import access
from girder.api.describe import Description, describeRoute
from girder.api.rest import Resource
from girder.constants import SortDir, AccessType
from girder.exceptions import AccessException
from ..models.history import History as HistoryModel

class History(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = 'history'

        self._historyModel = HistoryModel()

        self.route('GET', (), self.find)
        self.route('PUT', ('undo',), self.undo)
        self.route('PUT', ('redo',), self.redo)

    @access.user
    @describeRoute(Description("Get last history actions for the user, from the most recent to the oldest"))
    def find(self, params):
        user = self.getCurrentUser()
        if user is None:
            raise AccessException('You must be logged in.')
        return self._historyModel.getLastEntries(user)

    @access.user
    @describeRoute(Description("Undo the last history entry which hasn't been undone"))
    def undo(self, params):
        user = self.getCurrentUser()
        if user is None:
            raise AccessException('You must be logged in.')
        return self._historyModel.undo(user)

    @access.user
    @describeRoute(Description("Redo the last history entry which has been undone"))
    def redo(self, params):
        user = self.getCurrentUser()
        if user is None:
            raise AccessException('You must be logged in.')
        self._historyModel.redo(user)
