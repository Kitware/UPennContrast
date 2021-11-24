from girder.api import access
from girder.api.describe import Description, autoDescribeRoute, describeRoute
from girder.constants import AccessType
from girder.api.rest import Resource, loadmodel
from ..models.connections import AnnotationConnection as ConnectionModel
from girder.exceptions import AccessException, RestException, ValidationException


class AnnotationConnection(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = 'annotation_connection'

        self._connectionModel = ConnectionModel()

        self.route('DELETE', (':id',), self.delete)
        self.route('GET', (':id',), self.get)
        self.route('GET', (), self.find)
        self.route('POST', (), self.create)
        self.route('PUT', (':id',), self.update)

    # TODO: anytime a dataset is mentioned, load the dataset and check for existence and that the user has access to it
    # TODO: load both childe and parent annotations, and check that they share existence, access and location
    # TODO: creation date, update date, creatorId
    # TODO: error handling and documentation

    @access.user
    @describeRoute(Description("Create a new connection").param('body', 'Connection Object', paramType='body'))
    def create(self, params):
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException('User not found', 'currentUser')
        return self._connectionModel.create(currentUser, self.getBodyJson())

    @describeRoute(Description("Delete an existing connection").param('id', 'The connection\'s Id', paramType='path').errorResponse('ID was invalid.')
                   .errorResponse('Write access was denied for the connection.', 403))
    @access.user
    @loadmodel(model='annotation_connection', plugin='upenncontrast_annotation', level=AccessType.WRITE)
    def delete(self, connection, params):
        self._connectionModel.remove(connection)

    @describeRoute(Description("Update an existing connection")
                   .param('id', 'The ID of the connection.', paramType='path')
                   .param('body', 'A JSON object containing the connection.',
                          paramType='body')
                   .errorResponse('Write access was denied for the item.', 403)
                   .errorResponse('Invalid JSON passed in request body.')
                   .errorResponse("Validation Error: JSON doesn't follow schema."))
    @access.user
    @loadmodel(model='annotation_connection', plugin='upenncontrast_annotation', level=AccessType.WRITE)
    def update(self, connection, params):
        connection.update(self.getBodyJson())
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
        if 'datasetId' in params:
          query['datasetId'] = params['datasetId']
        elif 'childId' in params:
            query['childId'] = params['childId']
        elif 'parentId' in params:
            query['parentId'] = params['parentId']
        elif 'nodeAnnotationId' in params:
            query['$or'] = [
                {
                    'parentId': params['nodeAnnotationId']
                },
                {
                    'childId': params['nodeAnnotationId']
                }
            ]
        print(query)
        return self._connectionModel.findWithPermissions(query, sort=sort, user=self.getCurrentUser(), level=AccessType.READ, limit=limit, offset=offset)

    @access.user
    @autoDescribeRoute(Description("Get an connection by its id.")
                       .param('id', 'The connection\'s id'))
    @loadmodel(model='annotation_connection', plugin='upenncontrast_annotation', level=AccessType.READ)
    def get(self, annotation_connection):
        return annotation_connection
