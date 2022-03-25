import annotation_client.annotations as annotations
import annotation_client.tiles as tiles
import girder_client
import urllib
import imageio

PATHS = {
    'interface': '/worker_interface/{image}',
    'preview': '/worker_preview/{image}',
}


class UPennContrastWorkerPreviewClient:
    """
    Helper class to set interface and preview data for various worker images
    """

    def __init__(self, apiUrl, token):
        """
        The constructor will initialize the client with the provided parameters

        :param str apiUrl: The api URL to the girder server
        :param str token: The girder token for authentication
        """

        self.client = girder_client.GirderClient(apiUrl=apiUrl)
        self.client.setToken(token)

    # Annotations
    def setWorkerImageInterface(self, image, interface):
        """
        Set interface data for the specified docker image
        :param image: The full docker image name
        :param interface: The interface metadata
        :return: The created object (Note: will contain the _id field)
        :rtype: dict
        """
        return self.client.post(PATHS['interface'].format(image=urllib.parse.quote(image, safe='')), json=interface)

    def setWorkerImagePreview(self, image, preview):
        """
        Set preview data for the specified docker image
        :param image: The full docker image name
        :param interface: The preview metadata
        :return: The created object (Note: will contain the _id field)
        :rtype: dict
        """
        return self.client.post(PATHS['preview'].format(image=urllib.parse.quote(image, safe='')), json=preview)
    

class UPennContrastWorkerClient:

    def __init__(self, datasetId, apiUrl, token, params):

        self.datasetId = datasetId
        self.apiUrl = apiUrl
        self.token = token
        self.params = params

        self.propertyName = params.get('customName', None)
        if not self.propertyName:
            self.propertyName = params.get('name', 'unknown_property')

        # Setup helper classes with url and credentials
        self.annotationClient = annotations.UPennContrastAnnotationClient(
            apiUrl=apiUrl, token=token)
        self.datasetClient = tiles.UPennContrastDataset(
            apiUrl=apiUrl, token=token, datasetId=datasetId)

        # Cache downloaded images by location
        self.images = {}

    def get_annotation_list_by_id(self):

        annotationIds = self.params.get('annotationIds', None)

        annotationList = []
        # Get the annotations specified by id in the parameters
        for id in annotationIds:
            annotationList.append(self.annotationClient.getAnnotationById(id))

        return annotationList

    def get_annotation_list_by_shape(self, shape):

        # Get all point annotations from the dataset
        annotationList = self.annotationClient.getAnnotationsByDatasetId(
            self.datasetId, shape=shape)

        return annotationList

    def get_image_for_annotation(self, annotation):

        # Get image location
        channel = self.params.get('channel', None)
        if channel is None:  # Default to the annotation's channel, null means Any was selected
            channel = annotation.get('channel', None)
        if channel is None:
            return None

        location = annotation['location']
        time, z, xy = location['Time'], location['Z'], location['XY']

        # Look for cached image. Initialize cache if necessary.
        image = self.images.setdefault(channel, {}).setdefault(
            time, {}).setdefault(z, {}).get(xy, None)

        if image is None:
            # Download the image at specified location
            pngBuffer = self.datasetClient.getRawImage(xy, z, time, channel)

            # Read the png buffer
            image = imageio.imread(pngBuffer)

            # Cache the image
            self.images[channel][time][z][xy] = image

        return image

    def add_annotation_property_values(self, annotation, values):

        property_values = {self.propertyName: values}

        self.annotationClient.addAnnotationPropertyValues(self.datasetId, annotation['_id'], property_values)
 
