# -*- coding: utf-8 -*-

"""Top-level package for UpennContrast Annotation Plugin."""

__author__ = """Adrien Boucaud"""
__email__ = 'adrien.boucaud@kitware.com'
__version__ = '0.0.0'


from girder.plugin import GirderPlugin

from girder.utility.model_importer import ModelImporter

from .server.models.annotation import Annotation as AnnotationModel
from .server.models.connections import AnnotationConnection as ConnectionModel
from .server.models.propertyValues import AnnotationPropertyValues as PropertyValuesModel
from .server.models.property import AnnotationProperty as PropertyModel
from .server.models.workerInterfaces import WorkerInterfaceModel as InterfaceModel
from .server.models.workerPreviews import WorkerPreviewModel as PreviewModel

from .server.api.annotation import Annotation
from .server.api.connections import AnnotationConnection
from .server.api.propertyValues import PropertyValues
from .server.api.property import AnnotationProperty
from .server.api.workerInterfaces import WorkerInterfaces
from .server.api.workerPreviews import WorkerPreviews
class UPennContrastAnnotationAPIPlugin(GirderPlugin):
    DISPLAY_NAME = 'UPennContrast Annotation Plugin'
    def load(self, info):
        ModelImporter.registerModel('upenn_annotation', AnnotationModel, 'upenncontrast_annotation')
        ModelImporter.registerModel('annotation_connection', ConnectionModel, 'upenncontrast_annotation')
        ModelImporter.registerModel('annotation_property_values', PropertyValuesModel, 'upenncontrast_annotation')
        ModelImporter.registerModel('annotation_property', PropertyModel, 'upenncontrast_annotation')
        ModelImporter.registerModel('worker_interface', InterfaceModel, 'upenncontrast_worker_interface')
        ModelImporter.registerModel('worker_preview', PreviewModel, 'upenncontrast_worker_preview')

        info['apiRoot'].upenn_annotation = Annotation()
        info['apiRoot'].annotation_connection = AnnotationConnection()
        info['apiRoot'].annotation_property_values = PropertyValues()
        info['apiRoot'].annotation_property = AnnotationProperty()
        info['apiRoot'].worker_interface = WorkerInterfaces()
        info['apiRoot'].worker_preview = WorkerPreviews()
