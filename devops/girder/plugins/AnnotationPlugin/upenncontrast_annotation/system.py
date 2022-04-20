from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import boundHandler, filtermodel
from girder.constants import TokenScope
from girder.models.folder import Folder
from girder.models.item import Item


def addSystemEndpoints(apiRoot):
    """
    This adds endpoints to routes that already exist in Girder.

    :param apiRoot: Girder api root class.
    """
    # Added to the item route
    apiRoot.item.route('GET', ('query',), getItemsByQuery)
    # Added to the folder route
    apiRoot.folder.route('GET', ('query',), getFoldersByQuery)


@access.public(scope=TokenScope.DATA_READ)
@filtermodel(model=Item)
@autoDescribeRoute(
    Description('List items that match a query.')
    .responseClass('Item', array=True)
    .jsonParam('query', 'Find items that match this Mongo query.',
               required=True, requireObject=True)
    .pagingParams(defaultSort='_id')
    .errorResponse()
)
@boundHandler()
def getItemsByQuery(self, query, limit, offset, sort):
    user = self.getCurrentUser()
    return Item().findWithPermissions(query, offset=offset, limit=limit, sort=sort, user=user)


@access.public(scope=TokenScope.DATA_READ)
@filtermodel(model=Folder)
@autoDescribeRoute(
    Description('List folders that match a query.')
    .responseClass('Folder', array=True)
    .jsonParam('query', 'Find folders that match this Mongo query.',
               required=True, requireObject=True)
    .pagingParams(defaultSort='_id')
    .errorResponse()
)
@boundHandler()
def getFoldersByQuery(self, query, limit, offset, sort):
    user = self.getCurrentUser()
    return Folder().findWithPermissions(query, offset=offset, limit=limit, sort=sort, user=user)
