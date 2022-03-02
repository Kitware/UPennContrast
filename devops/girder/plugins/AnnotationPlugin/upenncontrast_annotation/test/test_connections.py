from jsonschema.validators import create
import pytest

import random
import copy

from upenncontrast_annotation.server.models.annotation import Annotation
from upenncontrast_annotation.server.models.connections import AnnotationConnection
from upenncontrast_annotation.server.models import connections

from . import girder_utilities as utilities
from . import upenn_testing_utilities as upenn_utilities

from girder.constants import AccessType
from girder.exceptions import AccessException, ValidationException
from girder.models.folder import Folder


def createTwoAnnotations(user):
    dataset = utilities.createFolder(
        user, 'dataset', upenn_utilities.datasetMetadata)

    parentData = upenn_utilities.getSampleAnnotation(dataset['_id'])
    parent = Annotation().create(user, parentData)

    childData = upenn_utilities.getSampleAnnotation(dataset['_id'])
    child = Annotation().create(user, childData)
    return (parent, child, dataset)


@pytest.mark.usefixtures('unbindLargeImage', 'unbindAnnotation')
@pytest.mark.plugin('upenncontrast_annotation')
class TestConnection:
    def testAnnotationSchema(self):
        schema = connections.ConnectionSchema
        assert schema.connectionSchema is not None
        assert schema.tagsSchema is not None

    def testConnectionCreate(self, admin):
        (parent, child, dataset) = createTwoAnnotations(admin)

        connection = upenn_utilities.getSampleConnection(
            parent['_id'], child['_id'], dataset['_id'])
        result = AnnotationConnection().create(admin, connection)
        assert '_id' in result
        annotId = result['_id']
        result = AnnotationConnection().load(annotId, user=admin)
        assert result is not None
        assert result['label'] == connection['label']

    def testLoad(self, admin):
        with pytest.raises(Exception, match='Invalid ObjectId'):
            AnnotationConnection().load('nosuchid')
        assert AnnotationConnection().load('012345678901234567890123', user=admin) is None

        (parent, child, dataset) = createTwoAnnotations(admin)
        connection = upenn_utilities.getSampleConnection(
            parent['_id'], child['_id'], dataset['_id'])
        result = AnnotationConnection().create(admin, connection)

        loaded = AnnotationConnection().load(result['_id'], user=admin)
        assert loaded['_id'] == result['_id'] and loaded['label'] == connection['label']

    def testRemove(self, user, admin):
        (parent, child, dataset) = createTwoAnnotations(user)
        connectionData = upenn_utilities.getSampleConnection(
            parent['_id'], child['_id'], dataset['_id'])
        connection = AnnotationConnection().create(user, connectionData)

        assert AnnotationConnection().load(
            connection['_id'], level=AccessType.READ, user=user) is not None
        result = AnnotationConnection().remove(connection)
        assert result.deleted_count == 1
        assert AnnotationConnection().load(
            connection['_id'], level=AccessType.READ, user=user) is None

    def testOnAnnotationRemove(self, user, admin):
        (annotation1, annotation2, dataset) = createTwoAnnotations(admin)
        connection = upenn_utilities.getSampleConnection(
            annotation1['_id'], annotation2['_id'], dataset['_id'])
        connectionInv = upenn_utilities.getSampleConnection(
            annotation2['_id'], annotation1['_id'], dataset['_id'])

        result = AnnotationConnection().create(admin, connection)
        resultInv = AnnotationConnection().create(admin, connectionInv)

        # Create a few additional connections to test with the cursor
        AnnotationConnection().create(admin, connection)
        AnnotationConnection().create(admin, connection)
        AnnotationConnection().create(admin, connectionInv)
        AnnotationConnection().create(admin, connectionInv)

        loaded = AnnotationConnection().load(result['_id'], user=admin)
        loadedInv = AnnotationConnection().load(resultInv['_id'], user=admin)
        assert loaded is not None
        assert loadedInv is not None

        Annotation().remove(annotation1)
        loaded = AnnotationConnection().load(result['_id'], user=admin)
        loadedInv = AnnotationConnection().load(resultInv['_id'], user=admin)
        assert loaded is None
        assert loadedInv is None

        query = {
            '$or': [
                {
                    'parentId': str(annotation1['_id'])
                },
                {
                    'childId': str(annotation2['_id'])
                }
            ]
        }
        cursor = AnnotationConnection().find(
            query, level=AccessType.READ, limit=2, user=admin)
        assert len(list(cursor)) == 0

    def testOnDatasetRemove(self, admin):
        (parent, child, dataset) = createTwoAnnotations(admin)
        connection = upenn_utilities.getSampleConnection(
            parent['_id'], child['_id'], dataset['_id'])
        result = AnnotationConnection().create(admin, connection)

        assert result is not None
        Folder().remove(dataset)
        test = Annotation().load(
            child['_id'], level=AccessType.READ, user=admin)
        assert test is None
        loaded = AnnotationConnection().load(
            connection['_id'], level=AccessType.READ, user=admin)
        assert loaded is None

    def testValidate(self, db, admin):
        # Test with missing child, missing parent, missing dataset
        (parent, child, dataset) = createTwoAnnotations(admin)
        connection = upenn_utilities.getSampleConnection(
            '012345678901234567890123', child['_id'], dataset['_id'])
        with pytest.raises(ValidationException, match='does not exist'):
            AnnotationConnection().validate(connection)

        connection = upenn_utilities.getSampleConnection(
            parent['_id'], '012345678901234567890123', dataset['_id'])
        with pytest.raises(ValidationException, match='does not exist'):
            AnnotationConnection().validate(connection)

        connection = upenn_utilities.getSampleConnection(
            parent['_id'], child['_id'], '012345678901234567890123')
        with pytest.raises(ValidationException, match='does not exist'):
            AnnotationConnection().validate(connection)

        empty = {}
        with pytest.raises(ValidationException):
            AnnotationConnection().validate(empty)

        folder = utilities.createFolder(admin, 'notADataset', {})
        connection = upenn_utilities.getSampleConnection(
            parent['_id'], child['_id'], folder['_id'])
        with pytest.raises(ValidationException, match='not a dataset'):
            AnnotationConnection().validate(connection)
