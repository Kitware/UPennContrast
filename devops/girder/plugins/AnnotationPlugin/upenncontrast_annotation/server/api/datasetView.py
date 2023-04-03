from girder.api.rest import Resource
from ..models.datasetView import DatasetView as DatasetViewModel


class DatasetView(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = 'dataset_view'
        self._propertyModel = DatasetViewModel()
