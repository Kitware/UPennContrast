"""Sharing must never hand out more access than the caller holds.

Before these checks, a WRITE collaborator could grant themselves ADMIN on a
dataset through POST dataset_view/share (accessType 2 on their own login), or
by adding the dataset to a project they own (the project's ACL, where they are
ADMIN, was copied onto the dataset). See helpers/aclLimits.py.
"""
import json
import random

import pytest
from pytest_girder.assertions import assertStatus, assertStatusOk

from girder.constants import AccessType
from girder.models.folder import Folder
from girder.models.user import User

from upenncontrast_annotation.server.models.collection import Collection
from upenncontrast_annotation.server.models.datasetView import (
    DatasetView as DatasetViewModel
)
from upenncontrast_annotation.server.models.project import Project

from . import girder_utilities as utilities
from . import upenn_testing_utilities as upenn_utilities

CONFIG_META = {
    "subtype": "contrastDataset",
    "compatibility": {},
    "layers": [],
    "tools": [],
    "propertyIds": [],
    "snapshots": [],
    "scales": {},
}


def makeUser(login):
    return User().createUser(
        login=login, password="password", firstName=login,
        lastName="User", email=f"{login}@girder.test", admin=False,
    )


# Girder makes the first user in a fresh database a site admin, and a site
# admin holds ADMIN on everything; requesting `admin` first keeps these
# ordinary users.
@pytest.fixture
def owner(admin):
    return makeUser("owner")


@pytest.fixture
def third(admin):
    return makeUser("third")


def createConfiguration(creator, dataset):
    return Collection().createCollection(
        name=f"config_{random.random()}", creator=creator, folder=dataset,
        metadata=CONFIG_META, description="")


def ownFolder(user):
    """A folder of user's own: a configuration inherits its folder's ACL."""
    return utilities.createPrivateFolder(
        user, f"folder_{random.random()}", {})


def createView(creator, dataset, config):
    return DatasetViewModel().create(creator, {
        "datasetId": dataset["_id"],
        "configurationId": config["_id"],
        "lastLocation": {"xy": 0, "z": 0, "time": 0},
        "layerContrasts": {},
    })


def createDataset(creator):
    dataset = utilities.createPrivateFolder(
        creator, f"dataset_{random.random()}",
        upenn_utilities.datasetMetadata)
    config = createConfiguration(creator, dataset)
    return dataset, config, createView(creator, dataset, config)


def grant(doc, model, user, level):
    model.setUserAccess(doc, user, level, save=True)


def levelOf(model, doc, user):
    return model.getAccessLevel(model.load(doc["_id"], force=True), user)


def levels(user, dataset, config, view):
    return (
        levelOf(Folder(), dataset, user),
        levelOf(Collection(), config, user),
        levelOf(DatasetViewModel(), view, user),
    )


def share(server, actor, views, target, level):
    return server.request(
        path="/dataset_view/share", method="POST", user=actor,
        type="application/json",
        body=json.dumps({
            "datasetViewIds": [str(v["_id"]) for v in views],
            "userMailOrUsername": target["login"],
            "accessType": level,
        }))


def shareWithWrite(dataset, config, view, user):
    for doc, model in ((dataset, Folder()), (config, Collection()),
                       (view, DatasetViewModel())):
        grant(doc, model, user, AccessType.WRITE)


NO_ACCESS = AccessType.NONE
READ, WRITE, ADMIN = AccessType.READ, AccessType.WRITE, AccessType.ADMIN


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestDatasetViewShareLimits:

    def testWriteCollaboratorCannotGrantThemselvesAdmin(
            self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)

        resp = share(server, user, [view], user, ADMIN)

        assertStatus(resp, 403)
        assert levels(user, dataset, config, view) == (WRITE, WRITE, WRITE)

    def testWriteCollaboratorCannotShareWithOthers(
            self, server, owner, user, third):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)

        resp = share(server, user, [view], third, READ)

        assertStatus(resp, 403)
        assert levels(third, dataset, config, view) == (
            NO_ACCESS, NO_ACCESS, NO_ACCESS)

    def testWriteCollaboratorCannotRemoveOwner(self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)

        resp = share(server, user, [view], owner, -1)

        assertStatus(resp, 403)
        assert levels(owner, dataset, config, view) == (ADMIN, ADMIN, ADMIN)

    def testOwnerCanGrantAdmin(self, server, owner, third):
        dataset, config, view = createDataset(owner)

        assertStatusOk(share(server, owner, [view], third, ADMIN))

        assert levels(third, dataset, config, view) == (ADMIN, ADMIN, ADMIN)

    def testOwnerCanRemoveAccess(self, server, owner, third):
        dataset, config, view = createDataset(owner)
        assertStatusOk(share(server, owner, [view], third, WRITE))

        assertStatusOk(share(server, owner, [view], third, -1))

        assert levels(third, dataset, config, view) == (
            NO_ACCESS, NO_ACCESS, NO_ACCESS)

    def testConfigurationIsSharedAtNoMoreThanCallersLevel(
            self, server, owner, user, third):
        """The owner of a dataset can edit, but does not own, a
        configuration a collaborator made: granting ADMIN gives WRITE on it.
        """
        dataset, _, _ = createDataset(owner)
        theirConfig = createConfiguration(user, ownFolder(user))
        grant(theirConfig, Collection(), owner, WRITE)
        view = createView(owner, dataset, theirConfig)

        assertStatusOk(share(server, owner, [view], third, ADMIN))

        assert levels(third, dataset, theirConfig, view) == (
            ADMIN, WRITE, ADMIN)

    def testConfigurationOwnerIsNotDowngraded(self, server, owner, user):
        dataset, _, _ = createDataset(owner)
        theirConfig = createConfiguration(user, ownFolder(user))
        grant(theirConfig, Collection(), owner, WRITE)
        view = createView(owner, dataset, theirConfig)

        assertStatusOk(share(server, owner, [view], user, READ))

        assert levelOf(Folder(), dataset, user) == READ
        assert levelOf(Collection(), theirConfig, user) == ADMIN

    def testViewsMustShareOneDataset(self, server, owner, third):
        _, _, viewA = createDataset(owner)
        datasetB, configB, viewB = createDataset(owner)

        resp = share(server, owner, [viewA, viewB], third, READ)

        assertStatus(resp, 400)
        assert "same dataset" in resp.json["message"]
        assert levelOf(Folder(), datasetB, third) == NO_ACCESS

    def testEmptyViewListIsRejected(self, server, owner, third):
        resp = share(server, owner, [], third, READ)

        assertStatus(resp, 400)


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestProjectShareLimits:

    def createProject(self, server, creator):
        resp = server.request(
            path="/project", method="POST", user=creator,
            params={"name": f"project_{random.random()}"})
        assertStatusOk(resp)
        return resp.json

    def addDataset(self, server, actor, project, dataset):
        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/dataset", method="POST",
            user=actor, params={"datasetId": str(dataset["_id"])}))

    def testAddingDatasetToOwnProjectDoesNotGrantAdmin(
            self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)
        project = self.createProject(server, user)

        self.addDataset(server, user, project, dataset)

        assert levels(user, dataset, config, view) == (WRITE, WRITE, WRITE)

    def testAddingCollectionDoesNotReachUnsharedDatasets(
            self, server, owner, user):
        dataset, config, view = createDataset(owner)
        grant(config, Collection(), user, WRITE)
        project = self.createProject(server, user)

        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/collection", method="POST",
            user=user, params={"collectionId": str(config["_id"])}))

        assert levels(user, dataset, config, view) == (
            NO_ACCESS, WRITE, NO_ACCESS)

    def testSharingProjectSkipsDatasetsCallerDoesNotOwn(
            self, server, owner, user, third):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)
        project = self.createProject(server, user)
        self.addDataset(server, user, project, dataset)

        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/share", method="POST",
            user=user, params={
                "userMailOrUsername": third["login"],
                "accessType": ADMIN}))

        assert levels(third, dataset, config, view) == (
            NO_ACCESS, WRITE, WRITE)
        assert levelOf(Project(), project, third) == ADMIN

    def testRevokingProjectLeavesOwnerOfContainedDataset(
            self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)
        project = self.createProject(server, user)
        self.addDataset(server, user, project, dataset)
        projectDoc = Project().load(project["_id"], force=True)
        grant(projectDoc, Project(), owner, WRITE)

        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/share", method="POST",
            user=user, params={
                "userMailOrUsername": owner["login"], "accessType": -1}))

        assert levels(owner, dataset, config, view) == (ADMIN, ADMIN, ADMIN)

    def testOwnerSharingProjectGrantsAdmin(self, server, owner, third):
        dataset, config, view = createDataset(owner)
        project = self.createProject(server, owner)
        self.addDataset(server, owner, project, dataset)

        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/share", method="POST",
            user=owner, params={
                "userMailOrUsername": third["login"],
                "accessType": ADMIN}))

        assert levels(third, dataset, config, view) == (ADMIN, ADMIN, ADMIN)

    def testPublishingProjectSkipsDatasetsCallerDoesNotOwn(
            self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)
        project = self.createProject(server, user)
        self.addDataset(server, user, project, dataset)

        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/set_public", method="POST",
            user=user, params={"public": True}))

        for model, doc in ((Folder(), dataset), (Collection(), config),
                           (DatasetViewModel(), view)):
            assert not model.load(doc["_id"], force=True).get("public")
