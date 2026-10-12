"""Shared helpers for access control endpoints."""

from collections import defaultdict
from dataclasses import dataclass, field

from bson import ObjectId

from girder.constants import AccessType
from girder.exceptions import AccessException, RestException
from girder.models.folder import Folder
from girder.models.user import User

from ..models.annotation import Annotation
from ..models.collection import Collection
from ..models.datasetView import DatasetView
from ..models.propertyValues import MAX_IDS_PER_QUERY


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


@dataclass
class ProjectContents:
    """What a project's export publishes, as an access check saw it."""
    datasetIds: list
    collectionIds: list
    # dataset id -> configuration docs (with meta.propertyIds) its views use
    configsByDataset: dict = field(default_factory=dict)


def _requireDocsAccess(model, ids, user, level, fields):
    """Check access on the docs among `ids` that exist; return them by id."""
    docs = {}
    for doc in model.find({'_id': {'$in': list(ids)}}, fields=fields):
        model.requireAccess(doc, user, level)
        docs[doc['_id']] = doc
    return docs


def requireResourcesAccess(datasetIds, collectionIds, user,
                           level=AccessType.ADMIN, requireAll=False):
    """Check access on datasets and collections loaded in two queries.

    :param requireAll: Refuse ids that no longer resolve instead of
        ignoring them. A Zenodo draft still holds a deleted resource's
        files, and a missing document cannot be checked.
    :raises AccessException: If user lacks access to any of them, or (with
        requireAll) any of them no longer exists.
    :returns: (ids of the datasets that exist, collection documents that
        exist by id, with meta.propertyIds).
    """
    datasetIds = set(datasetIds)
    collectionIds = set(collectionIds)
    datasets = _requireDocsAccess(
        Folder(), datasetIds, user, level, ['access', 'public'])
    collections = _requireDocsAccess(
        Collection(), collectionIds, user, level,
        ['access', 'public', 'meta.propertyIds'])
    if requireAll and (
            len(datasets) < len(datasetIds)
            or len(collections) < len(collectionIds)):
        raise AccessException(
            'Some datasets or collections in this draft no longer exist; '
            'discard the draft and upload again.')
    return list(datasets), collections


def requireProjectContentsAccess(project, user, level=AccessType.ADMIN):
    """Check access on everything a project's export publishes.

    Project-level access says nothing about the resources in it: a dataset
    can be added by someone with only WRITE on it, and a project admin may
    not be able to read it at all. Publishing a project (Zenodo) is an owner
    operation on each dataset and collection it lists, and on each
    configuration its datasets' views use -- the export publishes those
    configurations' property definitions whether or not the project lists
    them. References to deleted resources are skipped, as the export skips
    them, and left out of the result.

    Views and project membership can change after the check, so the export
    must use what this returns rather than query them again, and publishing
    a draft must check what was uploaded (requireResourcesAccess on the
    returned ids), not the project as it is by then.

    :raises AccessException: If user lacks access to any of them.
    :returns: A ProjectContents of what was checked and exists.
    """
    meta = project.get('meta', {})
    datasetIds = list(_requireDocsAccess(
        Folder(),
        {ObjectId(d['datasetId']) for d in meta.get('datasets', [])},
        user, level, ['access', 'public']))
    collectionIds = {
        ObjectId(c['collectionId']) for c in meta.get('collections', [])}
    # Only views of datasets the export will upload, and only views the
    # user can read: creating a view does not check the dataset it names,
    # so anyone could otherwise add a configuration to the export (or
    # block it with one the user does not own).
    configIdsByDataset = defaultdict(set)
    if datasetIds:
        datasetViewModel = DatasetView()
        for view in datasetViewModel.find(
                {'datasetId': {'$in': datasetIds}},
                fields=['datasetId', 'configurationId', 'access',
                        'public']):
            if not datasetViewModel.hasAccess(
                    view, user, AccessType.READ):
                continue
            configIdsByDataset[view['datasetId']].add(
                view['configurationId'])
            collectionIds.add(view['configurationId'])
    collectionsById = _requireDocsAccess(
        Collection(), collectionIds, user, level,
        ['access', 'public', 'meta.propertyIds'])
    return ProjectContents(
        datasetIds=datasetIds,
        collectionIds=list(collectionsById),
        configsByDataset={
            datasetId: [
                collectionsById[c] for c in configIds
                if c in collectionsById]
            for datasetId, configIds in configIdsByDataset.items()
        },
    )


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


def formatAccessList(model, document):
    """Format a document's access list with user emails.

    Returns dict with 'public', 'users', and 'groups' keys.
    Users include id, login, name, email, and level. Share-link principals
    are managed only through the link list, never the named sharing table.

    :param model: The Girder model instance.
    :param document: The document to get access for.
    :returns: Dict with public, users, groups.
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
            if u['id'] in userEmails
        ],
        'groups': accessList.get('groups', []),
    }
