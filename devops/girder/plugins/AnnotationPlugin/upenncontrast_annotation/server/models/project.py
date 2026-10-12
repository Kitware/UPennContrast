"""
Project model for organizing datasets and collections for export to Zenodo.

Projects are abstract database objects (not tied to file structure) that
reference datasets and collections. Think of them like Gmail labels -
flat, non-hierarchical organizational tags.
"""

import datetime
from collections import defaultdict

import fastjsonschema
from bson import ObjectId
from girder.constants import AccessType
from girder.models.item import Item
from girder.models.folder import Folder
from girder.models.user import User
from girder.exceptions import ValidationException, GirderException

from ..helpers.aclLimits import (
    canPublish, explicitUserLevel, grantableLevel, limitToShareable,
)
from ..helpers.fastjsonschema import customJsonSchemaCompile
from ..helpers.proxiedModel import ProxiedModel
from ..models.datasetView import DatasetView as DatasetViewModel
from ..models.collection import Collection as CollectionModel


class ProjectSchema:
    projectSchema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "description": {"type": "string"},
            "creatorId": {"type": "objectId"},
            "created": {"type": "datetime"},
            "updated": {"type": "datetime"},
            "lowerName": {"type": "string"},
            "meta": {
                "type": "object",
                "properties": {
                    "datasets": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "datasetId": {"type": "objectId"},
                                "addedDate": {"type": "datetime"}
                            },
                            "required": ["datasetId", "addedDate"]
                        }
                    },
                    "collections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "collectionId": {"type": "objectId"},
                                "addedDate": {"type": "datetime"}
                            },
                            "required": ["collectionId", "addedDate"]
                        }
                    },
                    "metadata": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "license": {"type": "string"},
                            "keywords": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        }
                    },
                    "status": {
                        "type": "string",
                        "enum": ["draft", "exporting", "exported"]
                    }
                },
                "required": ["datasets", "collections", "metadata", "status"]
            },
        },
        "required": [
            "name",
            "description",
            "creatorId",
            "created",
            "updated",
            "lowerName",
            "meta"
        ]
    }


class Project(ProxiedModel):

    def __init__(self):
        super().__init__()
        self.schema = ProjectSchema.projectSchema

    jsonValidate = staticmethod(
        customJsonSchemaCompile(ProjectSchema.projectSchema)
    )

    def initialize(self):
        self.name = 'upenn_project'
        self.ensureIndices((
            'creatorId',
            'lowerName',
            'meta.datasets.datasetId',
            'meta.collections.collectionId',
            'meta.status',
            ([('creatorId', 1), ('lowerName', 1)], {})
        ))

        self.exposeFields(level=AccessType.READ, fields=(
            '_id', 'name', 'description', 'created', 'updated',
            'creatorId', 'meta', 'lowerName', 'public'
        ))

    def validate(self, document):
        try:
            self.jsonValidate(document)
        except fastjsonschema.JsonSchemaValueException as exp:
            raise ValidationException(exp)
        return document

    def createProject(self, name, creator, description=''):
        """Create a new empty project."""
        now = datetime.datetime.utcnow()

        if not isinstance(creator, dict) or '_id' not in creator:
            raise GirderException(
                'Creator must be a user.',
                'girder.models.project.creator-not-user'
            )

        return self.save({
            'name': Item()._validateString(name),
            'lowerName': Item()._validateString(name).lower(),
            'description': Item()._validateString(description),
            'creatorId': creator['_id'],
            'created': now,
            'updated': now,
            'meta': {
                'datasets': [],
                'collections': [],
                'metadata': {
                    'title': name,
                    'description': description,
                    'license': 'CC-BY-4.0',
                    'keywords': []
                },
                'status': 'draft'
            },
            'access': {
                'groups': [],
                'users': [
                    {
                        'id': creator['_id'],
                        'level': AccessType.ADMIN,
                        'flags': []
                    }
                ]
            },
        })

    @staticmethod
    def _ensureObjectId(value):
        """Convert string to ObjectId if needed."""
        return (
            ObjectId(value)
            if isinstance(value, str) else value
        )

    def _addResource(
        self, project, resourceId,
        collection_key, id_key, label
    ):
        """Add a resource to the project.

        :param collection_key: 'datasets' or 'collections'
        :param id_key: 'datasetId' or 'collectionId'
        :param label: Human-readable name for errors.
        """
        resourceId = self._ensureObjectId(resourceId)
        existing_ids = {
            r[id_key]
            for r in project['meta'][collection_key]
        }
        if resourceId in existing_ids:
            raise ValidationException(
                f'{label} already in project'
            )
        project['meta'][collection_key].append({
            id_key: resourceId,
            'addedDate': datetime.datetime.utcnow(),
        })
        project['updated'] = datetime.datetime.utcnow()
        return self.save(project)

    def _removeResource(
        self, project, resourceId,
        collection_key, id_key
    ):
        """Remove a resource from the project."""
        resourceId = self._ensureObjectId(resourceId)
        project['meta'][collection_key] = [
            r for r in project['meta'][collection_key]
            if r[id_key] != resourceId
        ]
        project['updated'] = datetime.datetime.utcnow()
        return self.save(project)

    def addDataset(self, project, datasetId):
        """Add a dataset to the project."""
        return self._addResource(
            project, datasetId,
            'datasets', 'datasetId', 'Dataset'
        )

    def removeDataset(self, project, datasetId):
        """Remove a dataset from the project."""
        return self._removeResource(
            project, datasetId,
            'datasets', 'datasetId'
        )

    def addCollection(self, project, collectionId):
        """Add a collection to the project."""
        return self._addResource(
            project, collectionId,
            'collections', 'collectionId',
            'Collection'
        )

    def removeCollection(self, project, collectionId):
        """Remove a collection from the project."""
        return self._removeResource(
            project, collectionId,
            'collections', 'collectionId'
        )

    def updateFields(self, project, name=None, description=None):
        """Update project name/description."""
        changed = False

        if name is not None:
            project['name'] = Item()._validateString(name)
            project['lowerName'] = project['name'].lower()
            changed = True

        if description is not None:
            project['description'] = Item()._validateString(description)
            changed = True

        if not changed:
            return project

        project['updated'] = datetime.datetime.utcnow()
        return self.save(project)

    def updateMetadata(self, project, metadata):
        """Update project publication metadata."""
        if 'meta' not in project:
            project['meta'] = {}
        if 'metadata' not in project['meta']:
            project['meta']['metadata'] = {}

        # Update metadata fields
        project['meta']['metadata'].update(metadata)

        project['updated'] = datetime.datetime.utcnow()
        return self.save(project)

    def updateStatus(self, project, status):
        """Update project status."""
        valid_statuses = ['draft', 'exporting', 'exported']
        if status not in valid_statuses:
            raise ValidationException(
                f'Invalid status. Must be one of: {valid_statuses}'
            )

        project['meta']['status'] = status
        project['updated'] = datetime.datetime.utcnow()
        return self.save(project)

    def _gatherAllResources(self, project):
        """Bulk-load all resources referenced by a project.

        Returns a dict with keys:
        - datasets: list of Folder documents
        - collections: list of Collection documents
        - datasetViews: list of DatasetView documents
        """
        dataset_ids = [
            d['datasetId']
            for d in project['meta']['datasets']
        ]
        collection_ids = [
            c['collectionId']
            for c in project['meta']['collections']
        ]

        # Bulk load datasets (Folders)
        datasets = list(Folder().find(
            {'_id': {'$in': dataset_ids}}
        )) if dataset_ids else []

        # Bulk load directly-referenced collections
        collections_by_id = {}
        if collection_ids:
            for c in CollectionModel().find(
                {'_id': {'$in': collection_ids}}
            ):
                collections_by_id[c['_id']] = c

        # Find all DatasetViews linked to project
        # datasets or project collections
        or_clauses = []
        if dataset_ids:
            or_clauses.append(
                {'datasetId': {'$in': dataset_ids}}
            )
        if collection_ids:
            or_clauses.append(
                {'configurationId': {'$in': collection_ids}}
            )

        dataset_views = []
        if or_clauses:
            dataset_views = list(DatasetViewModel().find(
                {'$or': or_clauses}
            ))
            # Bulk load extra configs from views not
            # already in the project's collection list
            extra_ids = {
                dv['configurationId']
                for dv in dataset_views
                if dv['configurationId']
                not in collections_by_id
            }
            if extra_ids:
                for c in CollectionModel().find(
                    {'_id': {'$in': list(extra_ids)}}
                ):
                    collections_by_id[c['_id']] = c

        return {
            'datasets': datasets,
            'collections': list(
                collections_by_id.values()
            ),
            'datasetViews': dataset_views,
        }

    def _bulkSetUserAccess(
        self, docs, model, actor, user_id, level
    ):
        """Set a single user's access on multiple docs, as
        `actor` may (see helpers.aclLimits.grantableLevel).

        Uses one $pull plus one $push per resulting level
        instead of N individual setUserAccess calls.

        :param docs: List of documents (with their ACLs).
        :param model: The Girder model instance.
        :param actor: The user making the change.
        :param user_id: The target user's ObjectId.
        :param level: AccessType level, or -1 to remove.
        """
        ids_by_level = defaultdict(list)
        for doc in docs:
            granted = grantableLevel(
                model, doc, actor, user_id, level
            )
            if granted is not None:
                ids_by_level[granted].append(doc['_id'])
        if not ids_by_level:
            return
        model.update(
            {'_id': {'$in': [
                doc_id for ids in ids_by_level.values()
                for doc_id in ids
            ]}},
            {'$pull': {
                'access.users': {'id': user_id}
            }}
        )
        for granted, ids in ids_by_level.items():
            if granted < 0:
                continue
            model.update(
                {'_id': {'$in': ids}},
                {'$push': {'access.users': {
                    'id': user_id,
                    'level': granted,
                    'flags': []
                }}}
            )

    def _bulkSetPublic(self, docs, model, actor, public):
        """Set the public flag on the docs `actor` owns.

        Publishing is an owner operation, so documents the
        actor does not administer are left as they are.
        Uses a single updateMany instead of N individual
        setPublic calls.

        :param docs: List of documents.
        :param model: The Girder model instance.
        :param actor: The user making the change.
        :param public: Boolean, True to make public.
        :returns: How many docs were left unchanged.
        """
        doc_ids = [
            doc['_id'] for doc in docs
            if canPublish(model, doc, actor)
        ]
        if doc_ids:
            model.update(
                {'_id': {'$in': doc_ids}},
                {'$set': {'public': public}}
            )
        return len(docs) - len(doc_ids)

    def _bulkSetAllUsersAccess(
        self, docs, model, project, actor
    ):
        """Apply project's full user ACL to multiple docs,
        as `actor` may (see helpers.aclLimits).

        Copying an ACL only adds access: an entry already at
        or above what the project would grant is kept, so
        adding your own dataset to a project where you are
        only WRITE does not demote you from its owner.

        Bulk-validates that users exist, then issues one
        $pull and one $push per distinct set of entries
        (almost always one set: the actor's level is usually
        the same on every doc).

        :param docs: List of documents (with their ACLs).
        :param model: The Girder model instance.
        :param project: The project document.
        :param actor: The user making the change.
        """
        if not docs:
            return
        project_users = project.get(
            'access', {}
        ).get('users', [])
        if not project_users:
            return
        # Bulk validate users exist
        user_ids = [u['id'] for u in project_users]
        valid_ids = {
            u['_id'] for u in User().find(
                {'_id': {'$in': user_ids}},
                fields=['_id']
            )
        }
        project_users = [
            u for u in project_users if u['id'] in valid_ids
        ]
        ids_by_entries = defaultdict(list)
        for doc in docs:
            entries = []
            for u in project_users:
                granted = grantableLevel(
                    model, doc, actor, u['id'], u['level']
                )
                existing = explicitUserLevel(doc, u['id'])
                if granted is None or granted < 0 or (
                    existing is not None and existing >= granted
                ):
                    continue
                entries.append(
                    (u['id'], granted, tuple(u.get('flags', [])))
                )
            if entries:
                ids_by_entries[tuple(entries)].append(doc['_id'])
        for entries, ids in ids_by_entries.items():
            query = {'_id': {'$in': ids}}
            model.update(
                query,
                {'$pull': {'access.users': {'id': {
                    '$in': [user_id for user_id, _, _ in entries]
                }}}}
            )
            model.update(
                query,
                {'$push': {'access.users': {'$each': [
                    {'id': user_id, 'level': level,
                     'flags': list(flags)}
                    for user_id, level, flags in entries
                ]}}}
            )

    def _applyToAllResourceTypes(
        self, resources, apply_fn
    ):
        """Apply a function to all resource types.

        :param resources: Dict from _gatherAllResources.
        :param apply_fn: fn(docs, model) to call.
        :returns: apply_fn's results, one per resource type.
        """
        return [
            apply_fn(resources['datasets'], Folder()),
            apply_fn(resources['collections'], CollectionModel()),
            apply_fn(resources['datasetViews'], DatasetViewModel()),
        ]

    def propagateUserAccess(
        self, project, targetUser, level, actor
    ):
        """Propagate a single user's access level to the
        project resources `actor` could share directly
        (helpers.aclLimits.limitToShareable), at no more than
        the actor's level on each (grantableLevel).

        :param project: The project document.
        :param targetUser: The Girder user document.
        :param level: AccessType level (0, 1, 2) or -1
                      to remove access.
        :param actor: The user sharing the project.
        """
        resources = limitToShareable(
            actor, self._gatherAllResources(project)
        )
        uid = targetUser['_id']
        self._applyToAllResourceTypes(
            resources,
            lambda docs, model: (
                self._bulkSetUserAccess(
                    docs, model, actor, uid, level
                )
            )
        )

    def propagatePublic(self, project, public, actor):
        """Set public/private on the project resources
        `actor` owns.

        :param project: The project document.
        :param public: Boolean, True to make public.
        :param actor: The user changing the project.
        :returns: How many resources were left unchanged
                  because the actor does not own them.
        """
        resources = self._gatherAllResources(project)
        return sum(self._applyToAllResourceTypes(
            resources,
            lambda docs, model: (
                self._bulkSetPublic(docs, model, actor, public)
            )
        ))

    def propagateAllUsersAccess(
        self, project, documents, model, actor
    ):
        """Apply the project's full user access list to
        one or more documents of a given model, limited to
        what `actor` may grant on each.

        :param project: The project document.
        :param documents: List of documents to update
                          (or a single document).
        :param model: The Girder model instance.
        :param actor: The user making the change.
        """
        if not isinstance(documents, list):
            documents = [documents]
        self._bulkSetAllUsersAccess(
            documents, model, project, actor
        )

    def _gatherDatasetResources(self, dataset):
        """Load a dataset's associated views and configs.

        Returns (dataset_views, configs) where:
        - dataset_views: list of DatasetView documents
        - configs: list of Collection documents
        """
        dvModel = DatasetViewModel()
        dataset_views = list(dvModel.find(
            {'datasetId': dataset['_id']}
        ))
        config_ids = {
            dv['configurationId']
            for dv in dataset_views
        }
        configs = []
        if config_ids:
            collModel = CollectionModel()
            configs = list(collModel.find(
                {'_id': {'$in': list(config_ids)}}
            ))
        return dataset_views, configs

    def _gatherCollectionResources(self, collection):
        """Load a collection's associated views and
        datasets.

        Returns (dataset_views, datasets) where:
        - dataset_views: list of DatasetView documents
        - datasets: list of Folder documents
        """
        dvModel = DatasetViewModel()
        dataset_views = list(dvModel.find(
            {'configurationId': collection['_id']}
        ))
        dataset_ids = {
            dv['datasetId'] for dv in dataset_views
        }
        datasets = []
        if dataset_ids:
            datasets = list(Folder().find(
                {'_id': {'$in': list(dataset_ids)}}
            ))
        return dataset_views, datasets

    def _propagateToResources(
        self, project, resources, propagate_type, actor
    ):
        """Propagate the project's ACL or public flag to
        resources newly added to it, limited to what `actor`
        may change on each (helpers.aclLimits).

        :param resources: Dict shaped like
                          _gatherAllResources' result.
        :param propagate_type: 'access' or 'public'.
        :param actor: The user making the change.
        """
        if propagate_type == 'access':
            self._applyToAllResourceTypes(
                limitToShareable(actor, resources),
                lambda docs, model: (
                    self.propagateAllUsersAccess(
                        project, docs, model, actor
                    )
                )
            )
        elif propagate_type == 'public':
            if not project.get('public', False):
                return
            self._applyToAllResourceTypes(
                resources,
                lambda docs, model: (
                    self._bulkSetPublic(
                        docs, model, actor, True
                    )
                )
            )

    def _datasetResources(self, dataset):
        views, configs = self._gatherDatasetResources(dataset)
        return {
            'datasets': [dataset],
            'collections': configs,
            'datasetViews': views,
        }

    def _collectionResources(self, collection):
        views, datasets = self._gatherCollectionResources(
            collection
        )
        return {
            'datasets': datasets,
            'collections': [collection],
            'datasetViews': views,
        }

    def propagateAccessToDataset(
        self, project, dataset, actor
    ):
        """Propagate project ACL to a dataset and its
        associated views/configs."""
        self._propagateToResources(
            project, self._datasetResources(dataset),
            'access', actor
        )

    def propagateAccessToCollection(
        self, project, collection, actor
    ):
        """Propagate project ACL to a collection and
        its associated views/datasets."""
        self._propagateToResources(
            project, self._collectionResources(collection),
            'access', actor
        )

    def propagatePublicToDataset(
        self, project, dataset, actor
    ):
        """Propagate project public flag to a dataset
        and its associated views/configs."""
        self._propagateToResources(
            project, self._datasetResources(dataset),
            'public', actor
        )

    def propagatePublicToCollection(
        self, project, collection, actor
    ):
        """Propagate project public flag to a collection
        and its associated views/datasets."""
        self._propagateToResources(
            project, self._collectionResources(collection),
            'public', actor
        )
