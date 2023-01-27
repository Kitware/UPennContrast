from girder.api import access
from girder.api.describe import Description, autoDescribeRoute, describeRoute
from girder.constants import AccessType
from girder.api.rest import Resource, loadmodel
from ..models.annotation import Annotation as AnnotationModel
from girder.exceptions import AccessException, RestException, ValidationException


class Annotation(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = 'upenn_annotation'

        self._annotationModel = AnnotationModel()

        self.route('DELETE', (':id',), self.delete)
        self.route('GET', (':id',), self.get)
        self.route('GET', (), self.find)
        self.route('POST', (), self.create)
        self.route('PUT', (':id',), self.update)
        self.route('POST', ('compute',), self.compute)
        self.route('POST', ('multiple',), self.createMultiple)
        self.route('DELETE', ('multiple',), self.deleteMultiple)

    # TODO: anytime a dataset is mentioned, load the dataset and check for existence and that the user has access to it
    # TODO: creation date, update date, creatorId
    # TODO: find annotations by roi, tag, childOf and parentOf
    # TODO(performance): smarter indexing
    # TODO(performance): use objectId whenever possible
    # TODO: error handling and documentation

    @access.user
    @describeRoute(Description("Create a new annotation").param('body', 'Annotation Object', paramType='body'))
    def create(self, params):
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException('User not found', 'currentUser')
        return self._annotationModel.create(currentUser, self.getBodyJson())

    @access.user
    @describeRoute(Description("Create multiple new annotations").param('body', 'Annotation Object List', paramType='body'))
    def createMultiple(self, params):
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException('User not found', 'currentUser')
        return [self._annotationModel.create(currentUser, annotation) for annotation in self.getBodyJson()]

    @describeRoute(Description("Delete an existing annotation").param('id', 'The annotation\'s Id', paramType='path').errorResponse('ID was invalid.')
                   .errorResponse('Write access was denied for the annotation.', 403))
    @access.user
    @loadmodel(model='upenn_annotation', plugin='upenncontrast_annotation', level=AccessType.WRITE)
    def delete(self, upenn_annotation, params):
        self._annotationModel.delete(upenn_annotation)

    @access.user
    @describeRoute(Description("Delete all annotations in the id list")
                   .param('body', 'A list of all annotation ids to delete.', paramType='body'))
    def deleteMultiple(self, params):
        stringIds = [stringId for stringId in self.getBodyJson()]
        self._annotationModel.deleteMultiple(stringIds)

    @describeRoute(Description("Update an existing annotation")
                   .param('id', 'The ID of the annotation.', paramType='path')
                   .param('body', 'A JSON object containing the annotation.',
                          paramType='body')
                   .errorResponse('Write access was denied for the item.', 403)
                   .errorResponse('Invalid JSON passed in request body.')
                   .errorResponse("Validation Error: JSON doesn't follow schema."))
    @access.user
    @loadmodel(model='upenn_annotation', plugin='upenncontrast_annotation', level=AccessType.WRITE)
    def update(self, upenn_annotation, params):
        upenn_annotation.update(self.getBodyJson())
        self._annotationModel.update(upenn_annotation)

    @access.user
    @describeRoute(Description("Search for annotations")
                   .responseClass('upenn_annotation')
                   .param('datasetId', 'Get all annotations in this dataset', required=True)
                   .param('shape', 'Filter annotations by shape', required=False)
                   .pagingParams(defaultSort='_id')
                   .errorResponse()
                   )
    def find(self, params):
        limit, offset, sort = self.getPagingParameters(params, 'lowerName')
        query = {}
        if 'datasetId' in params:
            query['datasetId'] = params['datasetId']
        else:
            return []
        if 'shape' in params:
            query['shape'] = params['shape']
        return self._annotationModel.findWithPermissions(query, sort=sort, user=self.getCurrentUser(), level=AccessType.READ, limit=limit, offset=offset)

    @access.user
    @describeRoute(Description("Get an annotation by its id.")
                   .param('id', 'The annotation\'s id', paramType='path'))
    @loadmodel(model='upenn_annotation', plugin='upenncontrast_annotation', level=AccessType.READ)
    def get(self, upenn_annotation, params):
        return upenn_annotation

    @access.user
    @describeRoute(Description("Compute annotations from a worker tool")
                   .param('datasetId', 'The dataset Id', required=False)
                   .param('body', 'A JSON object containing the worker tool', paramType='body'))
    def compute(self, params):
        datasetId = params.get('datasetId', None)
        if not datasetId:
            raise RestException(code=400, message="Missing datasetId parameter")
        return self._annotationModel.compute(datasetId, self.getBodyJson(), self.getCurrentUser())
