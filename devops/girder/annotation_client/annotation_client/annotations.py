import girder_client

PATHS = {
    'annotation': '/upenn_annotation/',
    'annotation_by_id': '/upenn_annotation/{annotationId}',
    'annotation_by_dataset': '/upenn_annotation?datasetId={datasetId}',

    'connection': '/annotation_connection/',
    'connection_by_id': '/annotation_connection/{connectionId}',

    'add_property_values': '/annotation_property_values?datasetId={datasetId}&annotationId={annotationId}',
    'get_dataset_properties': '/annotation_property_values?datasetId={datasetId}',
    'get_annotation_properties': '/annotation_property_values?datasetId={datasetId}&annotationId={annotationId}',
    'histogram': '/annotation_property_values/histogram?propertyId={propertyId}&datasetId={datasetId}&buckets={buckets}'
}


class UPennContrastAnnotationClient:
    """
    Helper class to exchange annotation related information from a remote UPennContrast girder instance.
    Most methods simply send a translated request to the girder API and return the result. No particular checks are done.
    """
    # TODO: get schemas from girder and validate here ?

    def __init__(self, apiUrl, token):
        """
        The constructor will initialize the client with the provided parameters

        :param str apiUrl: The api URL to the girder server
        :param str token: The girder token for authentication
        """

        self.client = girder_client.GirderClient(apiUrl=apiUrl)
        self.client.setToken(token)

    # Annotations

    def getAnnotationsByDatasetId(self, datasetId, shape=None): # TODO: shape
        """
        Get the list of all annotations in the specified dataset

        :param str datasetId: The dataset's id
        :param str shape: optional filter by shape
        :return: A list of annotations
        """
        url = PATHS['annotation_by_dataset'].format(datasetId=datasetId)

        if shape:
            url = '{url}&shape={shape}'.format(url=url, shape=shape)

        return self.client.get(url)

    def getAnnotationById(self, annotationId):
        """
        Get an annotation by its id

        :param str annotationId: The annotation's id
        :return: The annotation dict
        :rtype: dict
        """
        return self.client.get(PATHS['annotation_by_id'].format(annotationId=annotationId))

    def createAnnotation(self, annotation):
        """
        Create an annotation with the specified metadata.
        The annotation data should match the standard UPennContrast annotation schema
        Note: you can add an additional 'properties' field to the annotation to directly specify property values.
        The 'properties' field will be extracted and added to the property values in the database.

        :param dict annotation: The annotation metadata
        :return: The created annotation object (Note: will contain the _id field)
        :rtype: dict
        """
        return self.client.post(PATHS['annotation'], json=annotation)

    def updateAnnotation(self, annotationId, annotation):
        """
        Update an annotation with the specified metadata.
        The annotation data should match the standard UPennContrast annotation schema
        Note: you can add an additional 'properties' field to the annotation to directly specify property values.
        The 'properties' field will be extracted and added to the property values in the database.

        :param str annotationId: The annotation id
        :param dict annotation: The annotation metadata
        :return: The updated annotation object
        :rtype: dict
        """
        return self.client.put(PATHS['annotation_by_id'].format(annotationId=annotationId), json=annotation)

    def deleteAnnotation(self, annotationId):
        """
        Delete an annotation by its id
        :param str annotationId: The annotation's id
        """
        return self.client.delete(PATHS['annotation_by_id'].format(annotationId=annotationId))

    # Connections
    def getAnnotationConnections(self, datasetId=None, childId=None, parentId=None, nodeId=None):
        """
        Search for annotation connections with various parameters

        :param str datasetId: The dataset to which connections should belong
        :param str childId: Id of the annotation to which connections should point
        :param str parentId: Id of the annotation from which connections should point
        :param str nodeId: Id of the annotation that should be either a child or parent in the desired connections
        :return: The resulting list of connections
        :rtype: list
        """
        query = '?'
        if datasetId:
            query += 'datasetId=' + datasetId

        if childId:
            query += 'childId=' + childId

        if parentId:
            query += 'parentId=' + parentId

        if nodeId:
            query += 'nodeId=' + nodeId

        return self.client.get(PATHS['connection'] + query, )

    def getAnnotationConnectionById(self, connectionId=None):
        """
        Get a connection by its id

        :param str connectionId: The connection's id
        :return: The connection dict
        :rtype: dict
        """

        return self.client.get(PATHS['connection_by_id'] .format(connectionId=connectionId))

    def createConnection(self, connection):
        """
        Create a connection with the specified metadata.
        The connection dict should match the standard UPennContrast connection schema

        :param dict annotation: The connection metadata
        :return: The created connection object (Note: will contain the _id field)
        :rtype: dict
        """
        return self.client.post(PATHS['connection'], json=connection)

    def updateConnection(self, connectionId, connection):
        """
        Update an connection with the specified metadata.
        The connection data should match the standard UPennContrast connection schema

        :param str connectionId: The connection id
        :param dict connection: The connection metadata
        :return: The updated connection object
        :rtype: dict
        """
        return self.client.put(PATHS['connection_by_id'].format(connectionId=connectionId), json=connection)

    def deleteConnection(self, connectionId):
        """
        Delete a connection by its id.
        :param str connectionId: The connection id
        """
        return self.client.delete(PATHS['connection_by_id'].format(connectionId=connectionId))

    # Property values

    def addAnnotationPropertyValues(self, datasetId, annotationId, values):
        """
          Save one or multiple computed property values for the specified annotation
          :param str datasetId: The dataset id
          :param str annotationId: The annotation id
          :param dict values: A dict of values - {[propertyId]: value}
        """
        return self.client.post(PATHS['add_property_values'].format(datasetId=datasetId, annotationId=annotationId), json=values)

    def getPropertyHistogram(self, propertyId, datasetId, buckets=255):
        """
          Get a histogram of the specified property across all annotations in the specified dataset
          :param str propertyId: The property id
          :param str datasetId: The dataset id
          :param str buckets: The number of buckets in the histogram
          :return: The list of bins
          :rtype: list
        """
        return self.client.get(PATHS['histogram'].format(propertyId=propertyId, datasetId=datasetId, buckets=buckets))

    def getPropertyValuesForDataset(self, datasetId):
        """
          Get property values for all annotations in the specified dataset
          :param str datasetId:
          :return: All property values
          :rtype: list
        """
        return self.client.get(PATHS['get_dataset_properties'].format(datasetId=datasetId))

    def getPropertyValuesForAnnotation(self, datasetId, annotationId):
        """
          Get property values for an annotation
          :param str datasetId: The id of the annotation's dataset
          :param str annotationId: The annotation's id
          :return: Property values for the annotation
        """
        return self.client.get(PATHS['get_annotation_properties'].format(annotationId=annotationId, datasetId=datasetId))
