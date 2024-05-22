from girder.api import access
from girder.api.describe import Description, autoDescribeRoute, describeRoute
from girder.api.rest import Resource, loadmodel
from girder.constants import AccessType
from girder.exceptions import AccessException
from ..helpers.proxiedModel import recordable, memoizeBodyJson
from ..models.connections import AnnotationConnection as ConnectionModel
from ..models.annotation import Annotation as AnnotationModel

from bson.objectid import ObjectId


# Helper functions to get dataset ID for recordable endpoints

def getDatasetIdFromConnectionInBody(self: 'AnnotationConnection', *args, **kwargs):
    connection = kwargs["memoizedBodyJson"]
    return connection['datasetId']

def getDatasetIdFromConnectionListInBody(self: 'AnnotationConnection', *args, **kwargs):
    connections = kwargs["memoizedBodyJson"]
    return None if len(connections) <= 0 else connections[0]['datasetId']

def getDatasetIdFromLoadedConnection(self: 'AnnotationConnection', *args, **kwargs):
    connection = kwargs['annotation_connection']
    return connection['datasetId']

def getDatasetIdFromConnectionIdListInBody(self: 'AnnotationConnection', *args, **kwargs):
    connectionStringIds = kwargs["memoizedBodyJson"]
    query = {
      '_id': { '$in': [ObjectId(stringId) for stringId in connectionStringIds] },
    }
    cursor = self._connectionModel.findWithPermissions(query, user=self.getCurrentUser(), level=AccessType.READ, limit=1)
    connection = next(cursor, None)
    return None if connection is None else connection['datasetId']
    
def getDatasetIdFromInfoInBody(self: 'AnnotationConnection', *args, **kwargs):
    info = kwargs["memoizedBodyJson"]
    annotationsIdsToConnect = info['annotationsIds']
    annotationModel: AnnotationModel = AnnotationModel()
    for stringId in annotationsIdsToConnect:
        id = ObjectId(stringId)
        annotation = annotationModel.getAnnotationById(id, self.getCurrentUser())
        if annotation is not None:
            return annotation['datasetId']
    return None


class AnnotationConnection(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = 'annotation_connection'

        self._connectionModel: ConnectionModel = ConnectionModel()

        self.route('DELETE', (':id',), self.delete)
        self.route('GET', (':id',), self.get)
        self.route('GET', (), self.find)
        self.route('POST', (), self.create)
        self.route('PUT', (':id',), self.update)
        self.route('POST',('connectTo',) , self.connectToNearest)
        self.route('POST', ('multiple',), self.multipleCreate)
        self.route('DELETE', ('multiple',), self.deleteMultiple)

    # TODO: anytime a dataset is mentioned, load the dataset and check for existence and that the user has access to it
    # TODO: load both childe and parent annotations, and check that they share existence, access and location
    # TODO: creation date, update date, creatorId
    # TODO: error handling and documentation

    @access.user
    @describeRoute(Description("Create a new connection").param('body', 'Connection Object', paramType='body'))
    @memoizeBodyJson
    @recordable('Create a connection', getDatasetIdFromConnectionInBody)
    def create(self, params, *args, **kwargs):
        bodyJson = kwargs["memoizedBodyJson"]
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException('User not found', 'currentUser')
        return self._connectionModel.create(currentUser, bodyJson)

    @access.user
    @describeRoute(Description("Create multiple new connections").param('body', 'Connection Object List', paramType='body'))
    @memoizeBodyJson
    @recordable('Create multiple connections', getDatasetIdFromConnectionListInBody)
    def multipleCreate(self, params, *args, **kwargs):
        bodyJson = kwargs["memoizedBodyJson"]
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException('User not found', 'currentUser')
        return self._connectionModel.createMultiple(currentUser, bodyJson)

    @describeRoute(Description("Delete an existing connection").param('id', 'The connection\'s Id', paramType='path').errorResponse('ID was invalid.')
                   .errorResponse('Write access was denied for the connection.', 403))
    @access.user
    @loadmodel(model='annotation_connection', plugin='upenncontrast_annotation', level=AccessType.WRITE)
    @recordable('Delete a connection', getDatasetIdFromLoadedConnection)
    def delete(self, annotation_connection, params):
        self._connectionModel.remove(annotation_connection)

    @access.user
    @describeRoute(Description("Delete all annotation connections in the id list")
                   .param('body', 'A list of all annotation connection ids to delete.', paramType='body'))
    @memoizeBodyJson
    @recordable('Delete multiple connections', getDatasetIdFromConnectionIdListInBody)
    def deleteMultiple(self, params, *args, **kwargs):
        bodyJson = kwargs["memoizedBodyJson"]
        stringIds = [stringId for stringId in bodyJson]
        return self._connectionModel.deleteMultiple(stringIds)

    @describeRoute(Description("Update an existing connection")
                   .param('id', 'The ID of the connection.', paramType='path')
                   .param('body', 'A JSON object containing the connection.',
                          paramType='body')
                   .errorResponse('Write access was denied for the item.', 403)
                   .errorResponse('Invalid JSON passed in request body.')
                   .errorResponse("Validation Error: JSON doesn't follow schema."))
    @access.user
    @loadmodel(model='annotation_connection', plugin='upenncontrast_annotation', level=AccessType.WRITE)
    @memoizeBodyJson
    @recordable('Update a connection', getDatasetIdFromLoadedConnection)
    def update(self, connection, params, *args, **kwargs):
        bodyJson = kwargs["memoizedBodyJson"]
        connection.update(bodyJson)
        self._connectionModel.update(connection)

    @access.user
    @autoDescribeRoute(Description("Search for connections")
                       .responseClass('annotation_connection')
                       .param('datasetId', 'Get all connections in this dataset', required=False)
                       .param('parentId', 'Get all connections from this annotation', required=False)
                       .param('childId', 'Get all connections to this annotation', required=False)
                       .param('nodeAnnotationId', 'Get all connections to or from this annotation', required=False)
                       .pagingParams(defaultSort='_id')
                       .errorResponse()
                       )
    def find(self, params):
        limit, offset, sort = self.getPagingParameters(params, 'lowerName')
        query = {}
        if 'datasetId' in params and params['datasetId']:
          query['datasetId'] = params['datasetId']
        if 'childId' in params and params['childId']:
            query['childId'] = params['childId']
        if 'parentId' in params and params['parentId']:
            query['parentId'] = params['parentId']
        if 'nodeAnnotationId' in params and params['nodeAnnotationId']:
            query['$or'] = [
                {
                    'parentId': params['nodeAnnotationId']
                },
                {
                    'childId': params['nodeAnnotationId']
                }
            ]
        return self._connectionModel.findWithPermissions(query, sort=sort, user=self.getCurrentUser(), level=AccessType.READ, limit=limit, offset=offset)

    @access.user
    @autoDescribeRoute(Description("Get an connection by its id.")
                       .param('id', 'The connection\'s id', paramType='path'))
    @loadmodel(model='annotation_connection', plugin='upenncontrast_annotation', level=AccessType.READ)
    def get(self, annotation_connection):
        return annotation_connection


    @access.user
    @describeRoute(Description("Create connections between annotations").param('body', 'Connection Object', paramType='body'))
    @memoizeBodyJson
    @recordable('Create connections with nearest', getDatasetIdFromInfoInBody)
    def connectToNearest(self, params, *args, **kwargs):
        bodyJson = kwargs["memoizedBodyJson"]
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException('User not found', 'currentUser')
        return self._connectionModel.connectToNearest(user=currentUser, info=bodyJson)
