"""Shared helpers for access control endpoints."""

from girder.constants import AccessType
from girder.exceptions import AccessException, RestException
from girder.models.folder import Folder
from girder.models.user import User

from ..models.annotation import Annotation
from ..models.propertyValues import MAX_IDS_PER_QUERY

SHARE_ACCESS_TYPES = (
    AccessType.NONE, AccessType.READ, AccessType.WRITE, AccessType.ADMIN
)


def parseShareAccessType(accessType):
    """Convert a share request's accessType to a setUserAccess level.

    The share endpoints take -1 (AccessType.NONE) to mean "remove access",
    but Girder's setUserAccess only removes the entry when the level is None;
    any other value, -1 included, is stored as an inert {id, level: -1}
    entry that keeps the user listed in the access table.

    AccessType.validate would also accept SITE_ADMIN (100) and raises
    ValueError (a 500) on bad input, so the allowed set is checked here.
    The value must already be an int: int() would truncate a JSON 1.9 to
    WRITE, and bool is an int subclass.

    :param accessType: -1 (remove), 0 (READ), 1 (WRITE) or 2 (ADMIN).
    :returns: The AccessType level, or None to remove access.
    :raises RestException: 400 if accessType is not one of those levels.
    """
    if (isinstance(accessType, bool) or not isinstance(accessType, int)
            or accessType not in SHARE_ACCESS_TYPES):
        raise RestException(
            "accessType must be one of %s" % (SHARE_ACCESS_TYPES,), code=400)
    return None if accessType == AccessType.NONE else accessType


def requireCanSetUserAccess(model, document, user, targetUser, level):
    """Refuse an ACL change that reaches above the caller's own level.

    The caller may grant at most their own level, and may change or remove
    only a user whose current entry is no higher than their own. So a WRITE
    collaborator can share READ or WRITE, but can neither make anyone
    (themselves included) ADMIN nor demote or remove an owner.

    :param model: The AccessControlledModel the document belongs to.
    :param document: The document whose ACL is about to change.
    :param user: The user making the change.
    :param targetUser: The user whose access is changing.
    :param level: The new level, or None to remove access.
    :raises AccessException: If the change exceeds the caller's level.
    """
    userLevel = model.getAccessLevel(document, user)
    targetLevel = max(
        (entry['level']
         for entry in document.get('access', {}).get('users', [])
         if entry['id'] == targetUser['_id']),
        default=None,
    )
    if level is not None and level > userLevel:
        raise AccessException(
            'You cannot grant access above your own level')
    if targetLevel is not None and targetLevel > userLevel:
        raise AccessException(
            'You cannot change access for a user above your own level')


def requireDatasetsAccess(datasetIds, user, level=AccessType.WRITE):
    """Load all datasets in one query and check access on each.

    :param datasetIds: Iterable of dataset ObjectIds.
    :param user: The current user document.
    :param level: The required AccessType level.
    :raises AccessException: If user lacks access to any dataset.
    """
    datasetIds = list(set(datasetIds))
    if not datasetIds:
        return
    folderModel = Folder()
    datasets = list(folderModel.find(
        {'_id': {'$in': datasetIds}}
    ))
    if len(datasets) != len(datasetIds):
        found = {d['_id'] for d in datasets}
        missing = [d for d in datasetIds if d not in found]
        raise AccessException(
            'Dataset(s) not found: %s' % missing
        )
    for dataset in datasets:
        folderModel.requireAccess(dataset, user, level)


def requireAnnotationsInDatasets(entries):
    """Reject entries whose annotation is not in the entry's datasetId.

    Endpoints authorize a write by each entry's datasetId, but a write keyed
    by annotationId alone touches whichever dataset that annotation is in.
    Without this check, WRITE access to one dataset let a caller overwrite
    the values of any annotation in another (Codex P1, PR #1358).

    :param entries: Dicts with ObjectId "annotationId" and "datasetId".
    :raises RestException: 400 if an annotation is missing or belongs to a
        different dataset than its entry names, or an entry omits either id.
    """
    annotationIds = list({entry.get("annotationId") for entry in entries})
    datasetOf = {}
    for start in range(0, len(annotationIds), MAX_IDS_PER_QUERY):
        for annotation in Annotation().find(
            {"_id": {"$in": annotationIds[start:start + MAX_IDS_PER_QUERY]}},
            fields={"datasetId": 1},
        ):
            datasetOf[annotation["_id"]] = annotation["datasetId"]
    for entry in entries:
        annotationId = entry.get("annotationId")
        datasetId = entry.get("datasetId")
        if datasetId is None or datasetOf.get(annotationId) != datasetId:
            raise RestException(
                "Annotation %s does not belong to dataset %s"
                % (annotationId, datasetId),
                code=400,
            )


def fetchNamedUserEmails(userIds):
    """Bulk-fetch emails of ordinary users, excluding share-link principals.

    :param userIds: List of ObjectId user IDs.
    :returns: Dict mapping user ObjectId -> email string.
    """
    if not userIds:
        return {}
    users = list(User().find(
        {'_id': {'$in': userIds}, 'shareLink': {'$exists': False}},
        fields=['email']
    ))
    return {
        u['_id']: u.get('email', '')
        for u in users
    }


def formatAccessList(model, document, currentUser):
    """Format a document's access list with user emails.

    Returns dict with 'public', 'users', 'groups' and 'currentUserLevel'.
    currentUserLevel is the caller's effective level (groups and site admin
    included, the same getAccessLevel the share endpoints authorize with),
    so a client never infers its own rights from the direct-user rows.
    Users include id, login, name, email, and level. Share-link principals
    are managed only through the link list, never the named sharing table.
    Entries with a negative level grant nothing; they are leftovers from
    share endpoints that stored -1 instead of removing the user, so they
    are dropped rather than listed as a user with access.

    :param model: The Girder model instance.
    :param document: The document to get access for.
    :param currentUser: The user making the request.
    :returns: Dict with public, users, groups, currentUserLevel.
    """
    accessList = model.getFullAccessList(document)
    userIds = [
        u['id'] for u in accessList.get('users', [])
    ]
    userEmails = fetchNamedUserEmails(userIds)
    return {
        'public': document.get('public', False),
        'users': [
            {
                'id': str(u['id']),
                'login': u.get('login', ''),
                'name': u.get('name', ''),
                'email': userEmails.get(
                    u['id'], ''
                ),
                'level': u['level'],
            }
            for u in accessList.get('users', [])
            if u['id'] in userEmails and u['level'] >= AccessType.READ
        ],
        'groups': accessList.get('groups', []),
        'currentUserLevel': model.getAccessLevel(document, currentUser),
    }
