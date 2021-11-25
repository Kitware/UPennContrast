import girder_client

PATHS = {
    'image': '/item/{datasetId}/tiles/fzxy/{frameIndex}/0/0/0',
    'item': '/item?folderId={datasetId}',
    'tiles': '/item/{datasetId}/tiles'
}


class UPennContrastDataset:
    """
      Helper class to get tile images from a single dataset in a remote UPennContrast girder instance.
      Most methods simply send a translated request to the girder API and return the result. No particular checks are done.
    """
    # TODO: get schemas from girder and validate here ? Though validation is already done server-side

    def __init__(self, apiUrl, token, datasetId):
        """
        The constructor will initialize the client, and fetch necessary dataset information

        :param str apiUrl: The api URL to the girder server
        :param str token: The girder token for authentication
        :param str datasetId: The id of the dataset from which images are downloaded
        """
        self.client = girder_client.GirderClient(apiUrl=apiUrl)
        self.client.setToken(token)

        self.folderId = datasetId
        # Get the dataset item's id
        self.dataset = self.getDataset(datasetId)
        self.datasetId = self.dataset['_id']

        self.tiles = self.getTilesForDataset(self.datasetId)
        self.map = self.buildMap(self.tiles['frames'])

    def buildMap(self, frames):
        """
          Maps Channel, XY, Z and Time locations to frame indexes, for easier lookup further on
          :param frames: List of frames from the /item/{id}/tiles large_image girder endpoint (see getTilesForDataset)
          :return: A dict mapping from [channel][T][Z][XY] to a frame index
          :rtype: dict
        """
        map = {}

        for frame in frames:
            channel = frame['IndexC']
            XY = frame['IndexXY']
            Z = frame['IndexZ']
            T = frame['IndexT']
            index = frame['Frame']

            map.setdefault(channel, {}).setdefault(
                T, {}).setdefault(Z, {}).setdefault(XY, index)
        return map

    def getDataset(self, datasetId):
        """
        Fetch the actual dataset item from a dataset id

        :param str datasetId: The dataset directory id
        :return: The dataset item
        :rtype: dict
        """
        items = self.client.get(PATHS['item'].format(datasetId=datasetId))
        dataset = next(filter(lambda item: 'largeImage' in item, items))
        return dataset

    def getTilesForDataset(self, datasetId):
        """
        Get the tiles metadata for a dataset (/item/{id}/tiles)

        :param str datasetId: The dataset id
        :return: The tiles metadata
        :rtype: dict
        """
        return self.client.get(PATHS['tiles'].format(datasetId=datasetId))

    def coordinatesToFrameIndex(self, XY, Z=0, T=0, channel=0):
        """
        Maps XY, Time, Z and Channel coordinates to frame indexes
        :param int XY: The XY value
        :param int Z: The Z value
        :param int T: The Time value
        :param int : The Channel value
        :return: The index of the frame to fetch for these coordinates
        :rtype: int
        """
        return self.map[channel][T][Z][XY]

    def getRawImage(self, XY, Z=0, T=0, channel=0):
        """
        Download the image at the specified coordinates
        :param int XY: The XY value
        :param int Z: The Z value
        :param int T: The Time value
        :param int : The Channel value
        :return: The downloaded image as a binary buffer
        """
        frameIndex = self.coordinatesToFrameIndex(XY, Z, T, channel)
        response = self.client.get(PATHS['image'].format(
            datasetId=self.datasetId, frameIndex=frameIndex), jsonResp=False)
        return response.content
