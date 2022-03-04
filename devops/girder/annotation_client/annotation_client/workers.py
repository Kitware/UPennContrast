import girder_client
import urllib

PATHS = {
    'interface': '/worker_interface/{image}',
    'preview': '/worker_preview/{image}',
}


class UPennContrastWorkersClient:
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
