"""Limits on the ACL changes one user may make on another's behalf.

The rule everywhere is the one dataset_view/share enforces: WRITE on a
document is enough to share it, but never above the caller's own level, and
never by changing a user whose entry there is above the caller's level (an
owner). Without it a WRITE collaborator could grant themselves ADMIN.

Explicit requests (dataset_view/share, project/:id/share) refuse with a 403
when any reached document would break the rule
(access_helpers.requireCanSetUserAccess). Copying a project's ACL onto a
resource newly added to it caps each entry at the caller's level instead
(cappedCopyLevel): adding a dataset should not fail because of someone else's
grant.

Which documents a project change reaches at all is limitToShareable: the
ones the caller could share directly.
"""

from girder.constants import AccessType
from girder.models.folder import Folder

from ..models.collection import Collection
from ..models.datasetView import DatasetView

# Sharing a document needs edit access to it (dataset_view/share's rule).
MIN_LEVEL_TO_SHARE = AccessType.WRITE


def explicitUserLevel(doc, userId):
    """The level of userId's own entry in doc's ACL, or None."""
    for entry in doc.get('access', {}).get('users', []):
        if entry['id'] == userId:
            return entry['level']
    return None


def cappedCopyLevel(model, doc, actor, targetId, requested):
    """The level a copied project entry may give targetId on doc, or None.

    Copying only adds access: None (leave the doc alone) when the actor
    cannot share the doc, when the target already holds at least the capped
    level, or when the target's entry is above the actor's level (an owner's
    entry is never rewritten by someone below them).

    :param requested: The project entry's level (>= READ).
    :returns: The level to set, or None to leave the doc unchanged.
    """
    actorLevel = model.getAccessLevel(doc, actor)
    if actorLevel < MIN_LEVEL_TO_SHARE:
        return None
    granted = min(requested, actorLevel)
    existing = explicitUserLevel(doc, targetId)
    if existing is not None and existing >= granted:
        return None
    return granted


def canPublish(model, doc, actor):
    """Changing a document's public flag is an owner operation."""
    return model.hasAccess(doc, actor, AccessType.ADMIN)


def limitToShareable(actor, resources):
    """Keep only the resources `actor` could share through dataset_view/share.

    That endpoint needs WRITE on the dataset and on every view and
    configuration it is sent, and views only travel with their dataset.
    Project propagation reaches the same documents by other routes, so it
    applies the same precondition:

    - a dataset if the actor can edit it;
    - a dataset view if the actor can edit it and its dataset is kept;
    - a configuration if the actor can edit it.

    :param resources: Dict with 'datasets', 'collections' and 'datasetViews'
        lists (as Project._gatherAllResources returns).
    :returns: A dict of the same shape.
    """
    folderModel = Folder()
    viewModel = DatasetView()
    collectionModel = Collection()
    datasets = [
        d for d in resources['datasets']
        if folderModel.hasAccess(d, actor, MIN_LEVEL_TO_SHARE)
    ]
    keptFolderIds = {d['_id'] for d in datasets}
    # A view of a dataset that is not itself in the project (reached
    # through a project collection) needs that dataset's access too.
    otherFolderIds = {
        v['datasetId'] for v in resources['datasetViews']
    } - keptFolderIds - {d['_id'] for d in resources['datasets']}
    if otherFolderIds:
        keptFolderIds |= {
            folder['_id'] for folder in folderModel.find(
                {'_id': {'$in': list(otherFolderIds)}},
                fields=['access', 'public'])
            if folderModel.hasAccess(folder, actor, MIN_LEVEL_TO_SHARE)
        }
    return {
        'datasets': datasets,
        'collections': [
            c for c in resources['collections']
            if collectionModel.hasAccess(c, actor, MIN_LEVEL_TO_SHARE)
        ],
        'datasetViews': [
            v for v in resources['datasetViews']
            if v['datasetId'] in keptFolderIds
            and viewModel.hasAccess(v, actor, MIN_LEVEL_TO_SHARE)
        ],
    }
