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

        assertStatus(resp, 400)
        assert "your own access" in resp.json["message"]
        assert levels(user, dataset, config, view) == (WRITE, WRITE, WRITE)

    def testWriteCollaboratorCannotGrantAdminToAnotherAccount(
            self, server, owner, user, third):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)

        resp = share(server, user, [view], third, ADMIN)

        assertStatus(resp, 403)
        assert "Admin access denied" in resp.json["message"]
        assert levels(third, dataset, config, view) == (
            NO_ACCESS, NO_ACCESS, NO_ACCESS)

    def testOwnerCannotRemoveThemselves(self, server, owner):
        dataset, config, view = createDataset(owner)

        resp = share(server, owner, [view], owner, -1)

        assertStatus(resp, 400)
        assert levels(owner, dataset, config, view) == (ADMIN, ADMIN, ADMIN)

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

        # dataset_view/share would refuse the caller outright, so the
        # project route does not reach the view or configuration either
        assert levels(third, dataset, config, view) == (
            NO_ACCESS, NO_ACCESS, NO_ACCESS)
        assert levelOf(Project(), project, third) == ADMIN

    def testAddingOwnDatasetToProjectKeepsOwnership(
            self, server, owner, user):
        """A WRITE member adding their own dataset must not be demoted to
        the project's level on it."""
        project = self.createProject(server, owner)
        grant(Project().load(project["_id"], force=True), Project(), user,
              WRITE)
        dataset, config, view = createDataset(user)

        self.addDataset(server, user, project, dataset)

        assert levels(user, dataset, config, view) == (ADMIN, ADMIN, ADMIN)
        assert levels(owner, dataset, config, view) == (ADMIN, ADMIN, ADMIN)

    def testAddingOwnDatasetToPublicProjectPublishesAllOfIt(
            self, server, owner, user):
        project = self.createProject(server, owner)
        projectDoc = Project().load(project["_id"], force=True)
        grant(projectDoc, Project(), user, WRITE)
        Project().setPublic(projectDoc, True, save=True)
        dataset, config, view = createDataset(user)

        self.addDataset(server, user, project, dataset)

        for model, doc in ((Folder(), dataset), (Collection(), config),
                           (DatasetViewModel(), view)):
            assert model.load(doc["_id"], force=True).get("public")

    def testSharingProjectSkipsCollectionsCallerCanOnlyEdit(
            self, server, owner, user, third):
        """No route lets a non-owner share a collection on its own, so a
        collection added to a project with only WRITE stays as it is."""
        _, config, _ = createDataset(owner)
        grant(config, Collection(), user, WRITE)
        project = self.createProject(server, user)
        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/collection", method="POST",
            user=user, params={"collectionId": str(config["_id"])}))

        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/share", method="POST",
            user=user, params={
                "userMailOrUsername": third["login"],
                "accessType": READ}))

        assert levelOf(Collection(), config, third) == NO_ACCESS
        assert levelOf(Project(), project, third) == READ

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

    def testPublishingProjectReportsSkippedResources(
            self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)
        project = self.createProject(server, user)
        self.addDataset(server, user, project, dataset)

        resp = server.request(
            path=f"/project/{project['_id']}/set_public", method="POST",
            user=user, params={"public": True})

        assertStatusOk(resp)
        # dataset, configuration and view are all the owner's
        assert resp.json["skipped"] == 3

    def testProjectOwnerCannotRemoveThemselves(self, server, owner):
        dataset, config, view = createDataset(owner)
        project = self.createProject(server, owner)
        self.addDataset(server, owner, project, dataset)

        resp = server.request(
            path=f"/project/{project['_id']}/share", method="POST",
            user=owner, params={
                "userMailOrUsername": owner["login"], "accessType": -1})

        assertStatus(resp, 400)
        assert levelOf(Project(), project, owner) == ADMIN
        assert levels(owner, dataset, config, view) == (ADMIN, ADMIN, ADMIN)


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestZenodoRequiresOwnership:
    """Publishing a project hands out every file in it, so it needs ADMIN on
    each dataset and collection, not only on the project."""

    def projectWithDatasetOf(self, server, owner, user):
        dataset, config, view = createDataset(owner)
        shareWithWrite(dataset, config, view, user)
        project = TestProjectShareLimits().createProject(server, user)
        TestProjectShareLimits().addDataset(server, user, project, dataset)
        return project

    def testUploadRefusesDatasetsCallerDoesNotOwn(self, server, owner, user):
        project = self.projectWithDatasetOf(server, owner, user)

        resp = server.request(
            path="/zenodo/upload", method="POST", user=user,
            type="application/json",
            body=json.dumps({"projectId": project["_id"]}))

        assertStatus(resp, 403)
        assert "Admin access denied" in resp.json["message"]

    def testPublishRefusesDatasetsCallerDoesNotOwn(self, server, owner, user):
        project = self.projectWithDatasetOf(server, owner, user)

        resp = server.request(
            path=f"/zenodo/publish/{project['_id']}", method="POST",
            user=user)

        assertStatus(resp, 403)

    def testUploadRefusesConfigurationsReachedThroughViews(
            self, server, owner, user):
        """The export publishes the property definitions of every
        configuration the project's datasets' views use, listed in the
        project or not."""
        dataset, _, _ = createDataset(user)
        theirConfig = createConfiguration(owner, ownFolder(owner))
        grant(theirConfig, Collection(), user, WRITE)
        createView(user, dataset, theirConfig)
        project = TestProjectShareLimits().createProject(server, user)
        TestProjectShareLimits().addDataset(server, user, project, dataset)

        resp = server.request(
            path="/zenodo/upload", method="POST", user=user,
            type="application/json",
            body=json.dumps({"projectId": project["_id"]}))

        assertStatus(resp, 403)
        assert "Admin access denied" in resp.json["message"]

    def testUploadJobRechecksTheProjectItExports(self, server, owner, user):
        """The job reloads the project; a dataset added after the endpoint's
        check (WRITE on the project is enough to add one) must not ship."""
        from girder_jobs.constants import JobStatus
        from girder_jobs.models.job import Job
        from upenncontrast_annotation.server.helpers import zenodo_job

        project = self.projectWithDatasetOf(server, owner, user)
        job = Job().createJob(
            title="Zenodo Upload", type="zenodo_upload", user=user,
            kwargs={"projectId": project["_id"], "userId": str(user["_id"])})

        zenodo_job.run(job)

        assert Job().load(job["_id"], force=True)["status"] == JobStatus.ERROR
        meta = Project().load(project["_id"], force=True)["meta"]["zenodo"]
        assert meta["status"] == "error"
        assert "Admin access denied" in meta["error"]

    def testExportUsesTheConfigurationsItChecked(self, server, owner, user):
        """A view pointed at someone else's configuration after the check
        must not reach the export: it publishes what was checked."""
        from unittest.mock import MagicMock
        from bson import ObjectId
        from upenncontrast_annotation.server.helpers import zenodo_job
        from upenncontrast_annotation.server.helpers.access_helpers import (
            requireProjectContentsAccess,
        )
        from upenncontrast_annotation.server.models.annotation import (
            Annotation,
        )
        from upenncontrast_annotation.server.models.connections import (
            AnnotationConnection,
        )

        dataset, ownConfig, _ = createDataset(user)
        ownProperty, theirProperty = ObjectId(), ObjectId()
        ownConfig["meta"]["propertyIds"] = [str(ownProperty)]
        Collection().save(ownConfig)
        theirConfig = createConfiguration(owner, ownFolder(owner))
        theirConfig["meta"]["propertyIds"] = [str(theirProperty)]
        Collection().save(theirConfig)
        grant(theirConfig, Collection(), user, WRITE)
        project = TestProjectShareLimits().createProject(server, user)
        TestProjectShareLimits().addDataset(server, user, project, dataset)

        checked = requireProjectContentsAccess(
            Project().load(project["_id"], force=True), user)
        createView(user, dataset, theirConfig)  # after the check
        propertyModel = MagicMock()
        propertyModel.find.return_value = []
        valuesModel = MagicMock()
        valuesModel.find.return_value = []
        zenodo_job._build_annotation_json(
            dataset["_id"], Annotation(), AnnotationConnection(),
            checked.configsByDataset.get(dataset["_id"], []),
            propertyModel, valuesModel)

        query = propertyModel.find.call_args.args[0]
        assert set(query["_id"]["$in"]) == {ownProperty}

    def testPublishChecksWhatTheDraftContains(self, server, owner, user):
        """Removing a dataset from the project after the upload does not
        make its draft publishable by someone who lost access to it."""
        dataset, config, view = createDataset(owner)
        for doc, model in ((dataset, Folder()), (config, Collection()),
                           (view, DatasetViewModel())):
            grant(doc, model, user, ADMIN)
        project = TestProjectShareLimits().createProject(server, user)
        TestProjectShareLimits().addDataset(server, user, project, dataset)
        projectDoc = Project().load(project["_id"], force=True)
        projectDoc["meta"]["zenodo"] = {
            "status": "draft", "depositionId": 1,
            "uploadedResources": {
                "datasetIds": [dataset["_id"]],
                "collectionIds": [config["_id"]],
            },
        }
        Project().save(projectDoc)
        # The dataset's owner revokes; the publisher drops it from the project
        grant(Folder().load(dataset["_id"], force=True), Folder(), user, WRITE)
        assertStatusOk(server.request(
            path=f"/project/{project['_id']}/dataset/{dataset['_id']}",
            method="DELETE", user=user))

        resp = server.request(
            path=f"/zenodo/publish/{project['_id']}", method="POST",
            user=user)

        assertStatus(resp, 403)

    def testPublishRefusesDraftWithDeletedResources(self, server, owner):
        """A recorded resource that no longer exists cannot be checked, and
        the draft still holds its files: refuse to publish it."""
        dataset, config, _ = createDataset(owner)
        project = TestProjectShareLimits().createProject(server, owner)
        projectDoc = Project().load(project["_id"], force=True)
        projectDoc["meta"]["zenodo"] = {
            "status": "draft", "depositionId": 1,
            "uploadedResources": {
                "datasetIds": [dataset["_id"]],
                "collectionIds": [config["_id"]],
            },
        }
        Project().save(projectDoc)
        Folder().remove(Folder().load(dataset["_id"], force=True))

        resp = server.request(
            path=f"/zenodo/publish/{project['_id']}", method="POST",
            user=owner)

        assertStatus(resp, 403)
        assert "no longer exist" in resp.json["message"]

    def testUploadRecordsOnlyResourcesThatExist(self, server, owner):
        """A reference deleted before the upload is skipped by the export,
        so it must not be recorded either: publish would refuse it."""
        from upenncontrast_annotation.server.helpers.access_helpers import (
            requireProjectContentsAccess,
        )

        dataset, config, _ = createDataset(owner)
        goneDataset, goneConfig, _ = createDataset(owner)
        project = TestProjectShareLimits().createProject(server, owner)
        for ds in (dataset, goneDataset):
            TestProjectShareLimits().addDataset(server, owner, project, ds)
        Folder().remove(Folder().load(goneDataset["_id"], force=True))

        contents = requireProjectContentsAccess(
            Project().load(project["_id"], force=True), owner)

        assert contents.datasetIds == [dataset["_id"]]
        assert goneConfig["_id"] not in contents.collectionIds

    def testOwnerPassesTheOwnershipCheck(self, server, owner):
        dataset, _, _ = createDataset(owner)
        project = TestProjectShareLimits().createProject(server, owner)
        TestProjectShareLimits().addDataset(server, owner, project, dataset)

        resp = server.request(
            path="/zenodo/upload", method="POST", user=owner,
            type="application/json",
            body=json.dumps({"projectId": project["_id"]}))

        # Next gate: the owner has no Zenodo token configured
        assertStatus(resp, 400)
