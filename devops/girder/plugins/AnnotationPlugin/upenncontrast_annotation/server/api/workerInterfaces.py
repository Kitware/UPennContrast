from girder.api import access
from girder.api.describe import Description, describeRoute
from girder.api.rest import Resource
from ..models.workerInterfaces import WorkerInterfaceModel as InterfaceModel
import docker

class WorkerInterfaces(Resource):

    def __init__(self):
        super().__init__()
        self.dockerClient = docker.from_env()
        self.resourceName = 'worker_interface'
        self._interfaceModel = InterfaceModel()

        self.route('GET', (':image',), self.find)
        self.route('GET', ('available',), self.getAvailableImages)
        self.route('POST', (':image',), self.update)
        self.route('POST', (':image', 'request',), self.requestWorkerUpdate)

    @describeRoute(Description("Update an existing image interface")
                   .param('image', 'The docker image name for the worker.', paramType='path')
                   .param('body', 'A JSON object describing the interface.',
                          paramType='body'))
    @access.user
    def update(self, image, params):
        return self._interfaceModel.update(self.getCurrentUser(), image, self.getBodyJson())

    @access.user
    @describeRoute(Description("Search for image interfaces")
                   .param('image', 'The docker image name for the worker.', paramType='path')
                   )
    def find(self, image, params):
        return self._interfaceModel.getImageInterface(image) or {}

    @access.user
    @describeRoute(Description("List available images"))
    def getAvailableImages(self, params):
        images = self.dockerClient.images.list()
        labelFilter = lambda image : image.labels.get('isUPennContrastWorker', False) and len(image.tags)
        mapTag = lambda image: image.tags[0]
        return list (map(mapTag, filter(labelFilter, images)))

    @access.user
    @describeRoute(Description("Ask the worker to update its interface data"))
    def requestWorkerUpdate(self, image, params):
        return self._interfaceModel.requestWorkerUpdate(image)
