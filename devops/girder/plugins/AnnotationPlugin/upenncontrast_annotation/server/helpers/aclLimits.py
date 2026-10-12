"""Limits on the ACL changes one user may make on another's behalf.

Girder's own access endpoints (PUT folder/{id}/access) require ADMIN. The
plugin's sharing paths -- dataset_view/share and project sharing/propagation --
also write ACLs on dataset views and configurations the caller may only hold
WRITE on (a configuration a collaborator created), so they cannot simply
require ADMIN everywhere. These rules keep a caller from handing out more than
they hold: without them a WRITE collaborator could grant themselves ADMIN.
"""

from girder.constants import AccessType
from girder.models.folder import Folder

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
