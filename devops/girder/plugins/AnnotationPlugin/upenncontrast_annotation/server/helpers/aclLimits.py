"""Limits on the ACL changes one user may make on another's behalf.

Girder's own access endpoints (PUT folder/{id}/access) require ADMIN. The
plugin's sharing paths -- dataset_view/share and project sharing/propagation --
also write ACLs on dataset views and configurations the caller may only hold
WRITE on (a configuration a collaborator created), so they cannot simply
require ADMIN everywhere. These rules keep a caller from handing out more than
they hold: without them a WRITE collaborator could grant themselves ADMIN.

API layer and model layer both use them: the share endpoint directly, project
propagation (models/project.py) with the acting user passed down.
"""

from girder.constants import AccessType
from girder.models.folder import Folder

from ..models.collection import Collection

# Folders (datasets) are only re-shared by their owners, as in Girder core.
# Views and configurations can be re-shared by anyone who can edit them, up to
# their own level.
MIN_LEVEL_TO_SHARE_FOLDER = AccessType.ADMIN
MIN_LEVEL_TO_SHARE_OTHER = AccessType.WRITE


def minLevelToShare(model):
    if isinstance(model, Folder):
        return MIN_LEVEL_TO_SHARE_FOLDER
    return MIN_LEVEL_TO_SHARE_OTHER


def explicitUserLevel(doc, userId):
    """The level of userId's own entry in doc's ACL, or None."""
    for entry in doc.get('access', {}).get('users', []):
        if entry['id'] == userId:
            return entry['level']
    return None


def grantableLevel(model, doc, actor, targetId, requested):
    """The level `actor` may set for `targetId` on `doc`, or None to leave it.

    - The actor needs minLevelToShare(model) on the document at all.
    - A grant is capped at the actor's own level (WRITE on a configuration
      re-shares it at WRITE at most, never ADMIN).
    - An entry above the actor's level is left untouched, so a non-owner
      cannot downgrade or remove an owner.

    :param requested: AccessType level, or -1 to remove.
    :returns: The level to apply (-1 removes), or None to skip this document.
    """
    actorLevel = model.getAccessLevel(doc, actor)
    if actorLevel < minLevelToShare(model):
        return None
    existing = explicitUserLevel(doc, targetId)
    if existing is not None and existing > actorLevel:
        return None
    if requested < 0:
        return -1
    return min(requested, actorLevel)


def canPublish(model, doc, actor):
    """Changing a document's public flag is an owner operation."""
    return model.hasAccess(doc, actor, AccessType.ADMIN)


def limitToShareable(actor, resources):
    """Keep only the resources `actor` could share through dataset_view/share.

    That endpoint shares a dataset's views and their configurations only on
    behalf of the dataset's owner. Project propagation reaches the same
    documents by other routes (a dataset added with WRITE, a view found
    through a project collection), so it applies the same precondition:

    - a dataset only if the actor owns it (ADMIN);
    - a dataset view only if the actor owns the view's dataset;
    - a configuration if one of those views uses it, or if the actor owns
      the configuration itself.

    grantableLevel still caps each grant at the actor's own level.

    :param resources: Dict with 'datasets', 'collections' and 'datasetViews'
        lists (as Project._gatherAllResources returns).
    :returns: A dict of the same shape.
    """
    folderModel = Folder()
    folderIds = {d['_id'] for d in resources['datasets']} | {
        v['datasetId'] for v in resources['datasetViews']}
    ownedFolderIds = {
        folder['_id'] for folder in folderModel.find(
            {'_id': {'$in': list(folderIds)}}, fields=['access', 'public'])
        if folderModel.hasAccess(folder, actor, AccessType.ADMIN)
    } if folderIds else set()
    views = [
        v for v in resources['datasetViews']
        if v['datasetId'] in ownedFolderIds
    ]
    usedConfigIds = {v['configurationId'] for v in views}
    collectionModel = Collection()
    return {
        'datasets': [
            d for d in resources['datasets'] if d['_id'] in ownedFolderIds
        ],
        'collections': [
            c for c in resources['collections']
            if c['_id'] in usedConfigIds
            or collectionModel.hasAccess(c, actor, AccessType.ADMIN)
        ],
        'datasetViews': views,
    }
