"""Tests for dataset sharing functionality.

Tests the share, setDatasetPublic, and getDatasetAccess endpoints
in the DatasetView API.
"""
import json
import pytest
import random

from pytest_girder.assertions import assertStatus, assertStatusOk

from girder.constants import AccessType
from girder.exceptions import AccessException
from girder.models.folder import Folder
from girder.models.group import Group
from girder.models.user import User

from upenncontrast_annotation.server.models.datasetView import (
    DatasetView as DatasetViewModel
)
from upenncontrast_annotation.server.models.collection import Collection

from . import girder_utilities as utilities
from . import upenn_testing_utilities as upenn_utilities


def createDatasetWithView(creator):
    """Create a dataset folder, configuration, and dataset view."""
    # Create dataset folder with unique name
    unique_name = f"test_dataset_{random.random()}"
    dataset = utilities.createFolder(
        creator, unique_name, upenn_utilities.datasetMetadata
    )

    # Create configuration with unique name
    config_meta = {
        "subtype": "contrastDataset",
        "compatibility": {},
        "layers": [],
        "tools": [],
        "propertyIds": [],
        "snapshots": [],
        "scales": {}
    }
    config_name = f"test_config_{random.random()}"
    config = Collection().createCollection(
        name=config_name,
        creator=creator,
        folder=dataset,
        metadata=config_meta,
        description="Test configuration"
    )

    # Create dataset view linking them
    datasetView = DatasetViewModel().create(
        creator,
        {
            "datasetId": dataset["_id"],
            "configurationId": config["_id"],
            "lastLocation": {"xy": 0, "z": 0, "time": 0},
            "layerContrasts": {}
        }
    )

    return dataset, config, datasetView


aclUserIds = utilities.aclUserIds


def createUser(login):
    return User().createUser(
        login, "password", login, "User", f"{login}@example.com")


def shareDatasetView(server, sharer, datasetView, target, accessType):
    datasetViews = (
        datasetView if isinstance(datasetView, list) else [datasetView])
    return server.request(
        path="/dataset_view/share",
        method="POST",
        user=sharer,
        body=json.dumps({
            "datasetViewIds": [str(view["_id"]) for view in datasetViews],
            "userMailOrUsername": target["login"],
            "accessType": accessType,
        }),
        type="application/json",
    )


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestSharing:
    """Tests for the share endpoint."""

    def testShareWithReadAccess(self, admin, user):
        """Test sharing a dataset view with READ access."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Share with user at READ level
        DatasetViewModel().setUserAccess(
            datasetView, user, AccessType.READ, save=True
        )
        Collection().setUserAccess(
            config, user, AccessType.READ, save=True
        )
        Folder().setUserAccess(
            dataset, user, AccessType.READ, save=True
        )

        # User should now be able to load the dataset view
        loaded = DatasetViewModel().load(
            datasetView["_id"], user=user, level=AccessType.READ
        )
        assert loaded is not None
        assert loaded["_id"] == datasetView["_id"]

        # But user should NOT have write access (raises AccessException)
        with pytest.raises(AccessException):
            DatasetViewModel().load(
                datasetView["_id"], user=user, level=AccessType.WRITE
            )

    def testShareWithWriteAccess(self, admin, user):
        """Test sharing a dataset view with WRITE access."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Share with user at WRITE level
        DatasetViewModel().setUserAccess(
            datasetView, user, AccessType.WRITE, save=True
        )
        Collection().setUserAccess(
            config, user, AccessType.WRITE, save=True
        )
        Folder().setUserAccess(
            dataset, user, AccessType.WRITE, save=True
        )

        # User should have write access
        loaded = DatasetViewModel().load(
            datasetView["_id"], user=user, level=AccessType.WRITE
        )
        assert loaded is not None
        assert loaded["_id"] == datasetView["_id"]

    def testRemoveAccess(self, admin, user):
        """Test removing access: Girder removes the entry only for None."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # First grant access
        DatasetViewModel().setUserAccess(
            datasetView, user, AccessType.READ, save=True
        )
        Folder().setUserAccess(
            dataset, user, AccessType.READ, save=True
        )

        # Verify user has access
        loaded = DatasetViewModel().load(
            datasetView["_id"], user=user, level=AccessType.READ
        )
        assert loaded is not None

        # Remove access (None, which is what the share endpoint passes)
        DatasetViewModel().setUserAccess(
            datasetView, user, None, save=True
        )
        Folder().setUserAccess(
            dataset, user, None, save=True
        )
        assert user["_id"] not in aclUserIds(
            DatasetViewModel(), datasetView["_id"])
        assert user["_id"] not in aclUserIds(Folder(), dataset["_id"])

        # User should no longer have access (raises AccessException)
        with pytest.raises(AccessException):
            DatasetViewModel().load(
                datasetView["_id"], user=user, level=AccessType.READ
            )

    def testAccessTypeValidation(self, admin):
        """Test that AccessType validates -1, 0, 1, 2 correctly."""
        # -1 should be valid (no access / remove)
        result = AccessType().validate(-1)
        assert result == -1

        # 0 should be valid (READ)
        result = AccessType().validate(0)
        assert result == AccessType.READ

        # 1 should be valid (WRITE)
        result = AccessType().validate(1)
        assert result == AccessType.WRITE

        # 2 should be valid (ADMIN)
        result = AccessType().validate(2)
        assert result == AccessType.ADMIN

        # Invalid values should raise
        with pytest.raises(Exception):
            AccessType().validate(99)

    def testShareEndpointRemoveDropsAclEntries(self, admin, user, server):
        """Removing via the endpoint (-1) leaves no access.users entry on
        the folder, configuration or dataset view, not a level -1 one."""
        dataset, config, datasetView = createDatasetWithView(admin)
        assertStatusOk(shareDatasetView(
            server, admin, datasetView, user, AccessType.WRITE))
        assert user["_id"] in aclUserIds(Folder(), dataset["_id"])

        assertStatusOk(shareDatasetView(
            server, admin, datasetView, user, AccessType.NONE))

        assert user["_id"] not in aclUserIds(Folder(), dataset["_id"])
        assert user["_id"] not in aclUserIds(Collection(), config["_id"])
        assert user["_id"] not in aclUserIds(
            DatasetViewModel(), datasetView["_id"])
        resp = server.request(
            path=f"/dataset_view/access/{dataset['_id']}",
            method="GET",
            user=admin,
        )
        assertStatusOk(resp)
        assert str(user["_id"]) not in {u["id"] for u in resp.json["users"]}

    def testShareEndpointRemoveWithoutGrantIsNoop(self, admin, user, server):
        """Removing a user who was never shared adds no entry."""
        dataset, config, datasetView = createDatasetWithView(admin)
        assertStatusOk(shareDatasetView(
            server, admin, datasetView, user, AccessType.NONE))
        assert user["_id"] not in aclUserIds(Folder(), dataset["_id"])
        assert user["_id"] not in aclUserIds(Collection(), config["_id"])
        assert user["_id"] not in aclUserIds(
            DatasetViewModel(), datasetView["_id"])

    def _writeCollaborator(self, admin, user):
        """A dataset owned by admin, with user at WRITE on all of it."""
        dataset, config, datasetView = createDatasetWithView(admin)
        for model, document in (
            (Folder(), dataset), (Collection(), config),
            (DatasetViewModel(), datasetView),
        ):
            model.setUserAccess(document, user, AccessType.WRITE, save=True)
        return dataset, config, datasetView

    def testWriteUserCanShareUpToWrite(self, admin, user, server):
        """WRITE is enough to grant READ or WRITE, and to remove a peer."""
        dataset, config, datasetView = self._writeCollaborator(admin, user)
        third = createUser("third")

        for level in (AccessType.READ, AccessType.WRITE):
            assertStatusOk(shareDatasetView(
                server, user, datasetView, third, level))
            folder = Folder().load(dataset["_id"], force=True)
            assert {u["id"]: u["level"] for u in folder["access"]["users"]}[
                third["_id"]] == level

        assertStatusOk(shareDatasetView(
            server, user, datasetView, third, AccessType.NONE))
        assert third["_id"] not in aclUserIds(Folder(), dataset["_id"])

    def testWriteUserCannotExceedOwnLevel(self, admin, user, server):
        """A WRITE collaborator can't make anyone (themselves included)
        ADMIN, nor demote or remove the owner."""
        dataset, config, datasetView = self._writeCollaborator(admin, user)
        third = createUser("third")

        for target, level in ((user, AccessType.ADMIN),
                              (third, AccessType.ADMIN),
                              (admin, AccessType.WRITE),
                              (admin, AccessType.NONE)):
            assertStatus(shareDatasetView(
                server, user, datasetView, target, level), 403)

        for model, documentId in (
            (Folder(), dataset["_id"]), (Collection(), config["_id"]),
            (DatasetViewModel(), datasetView["_id"]),
        ):
            document = model.load(documentId, force=True)
            levels = {u["id"]: u["level"]
                      for u in document["access"]["users"]}
            assert levels[user["_id"]] == AccessType.WRITE
            assert levels[admin["_id"]] == AccessType.ADMIN
            assert third["_id"] not in levels

    def testOwnLevelIsCheckedPerDocument(self, admin, user, server):
        """WRITE on the dataset doesn't let a caller demote someone who
        owns the configuration; each touched document is checked, and a
        refusal changes nothing."""
        dataset, config, datasetView = self._writeCollaborator(admin, user)
        configOwner = createUser("configowner")
        Folder().setUserAccess(
            dataset, configOwner, AccessType.READ, save=True)
        Collection().setUserAccess(
            config, configOwner, AccessType.ADMIN, save=True)

        assertStatus(shareDatasetView(
            server, user, datasetView, configOwner, AccessType.WRITE), 403)
        folder = Folder().load(dataset["_id"], force=True)
        assert {u["id"]: u["level"] for u in folder["access"]["users"]}[
            configOwner["_id"]] == AccessType.READ
        config = Collection().load(config["_id"], force=True)
        assert {u["id"]: u["level"] for u in config["access"]["users"]}[
            configOwner["_id"]] == AccessType.ADMIN

    def testShareEndpointRejectsViewsOfSeveralDatasets(
            self, admin, user, server):
        """Views of several datasets in one request are a 400."""
        _, _, viewA = createDatasetWithView(admin)
        datasetB, _, viewB = createDatasetWithView(admin)
        assertStatus(shareDatasetView(
            server, admin, [viewA, viewB], user, AccessType.READ), 400)
        assert user["_id"] not in aclUserIds(Folder(), datasetB["_id"])

    @pytest.mark.parametrize(
        "accessType", [100, 3, -2, "write", 1.9, 0.5, True])
    def testShareEndpointRejectsInvalidAccessType(
            self, admin, user, server, accessType):
        """Only the ints -1/0/1/2 are share levels; SITE_ADMIN (100),
        fractions (1.9 must not truncate to WRITE), booleans and garbage
        are a clean 400, not a stored level or a 500."""
        dataset, config, datasetView = createDatasetWithView(admin)
        resp = server.request(
            path="/dataset_view/share",
            method="POST",
            user=admin,
            body=json.dumps({
                "datasetViewIds": [str(datasetView["_id"])],
                "userMailOrUsername": user["login"],
                "accessType": accessType,
            }),
            type="application/json",
        )
        assertStatus(resp, 400)
        assert user["_id"] not in aclUserIds(Folder(), dataset["_id"])


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestSetDatasetPublic:
    """Tests for the setDatasetPublic endpoint."""

    def testMakeDatasetPublic(self, admin):
        """Test making a dataset and its resources public."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # First ensure they are private
        Folder().setPublic(dataset, False, save=True)
        DatasetViewModel().setPublic(datasetView, False, save=True)
        Collection().setPublic(config, False, save=True)

        # Reload and verify private
        dataset = Folder().load(dataset["_id"], force=True)
        assert dataset.get("public", False) is False

        # Now make public
        Folder().setPublic(dataset, True, save=True)
        DatasetViewModel().setPublic(datasetView, True, save=True)
        Collection().setPublic(config, True, save=True)

        # Reload and verify public
        dataset = Folder().load(dataset["_id"], force=True)
        datasetView = DatasetViewModel().load(datasetView["_id"], force=True)
        config = Collection().load(config["_id"], force=True)

        assert dataset.get("public", False) is True
        assert datasetView.get("public", False) is True
        assert config.get("public", False) is True

    def testMakeDatasetPrivate(self, admin):
        """Test making a public dataset private."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Make public first
        Folder().setPublic(dataset, True, save=True)
        DatasetViewModel().setPublic(datasetView, True, save=True)
        Collection().setPublic(config, True, save=True)

        # Now make private
        Folder().setPublic(dataset, False, save=True)
        DatasetViewModel().setPublic(datasetView, False, save=True)
        Collection().setPublic(config, False, save=True)

        # Reload and verify
        dataset = Folder().load(dataset["_id"], force=True)
        datasetView = DatasetViewModel().load(datasetView["_id"], force=True)
        config = Collection().load(config["_id"], force=True)

        assert dataset.get("public", False) is False
        assert datasetView.get("public", False) is False
        assert config.get("public", False) is False

    def testPublicDatasetAccessibleToAnonymous(self, admin):
        """Test that public datasets are accessible without authentication."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Make public
        Folder().setPublic(dataset, True, save=True)
        DatasetViewModel().setPublic(datasetView, True, save=True)

        # Should be accessible with user=None (anonymous)
        loaded = DatasetViewModel().load(
            datasetView["_id"], user=None, level=AccessType.READ
        )
        assert loaded is not None
        assert loaded["_id"] == datasetView["_id"]


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestGetDatasetAccess:
    """Tests for the getDatasetAccess endpoint."""

    def testGetAccessListBasic(self, admin):
        """Test getting the access list for a dataset."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Get access list
        accessList = Folder().getFullAccessList(dataset)

        # Should have users and groups
        assert "users" in accessList
        assert "groups" in accessList

        # Admin should be in the users list
        adminInList = any(
            u["id"] == admin["_id"] for u in accessList["users"]
        )
        assert adminInList is True

    def testGetAccessListWithSharedUser(self, admin, user):
        """Test that shared users appear in access list."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Share with user
        Folder().setUserAccess(dataset, user, AccessType.READ, save=True)

        # Get access list
        accessList = Folder().getFullAccessList(dataset)

        # Both admin and user should be in the list
        userIds = {u["id"] for u in accessList["users"]}
        assert admin["_id"] in userIds
        assert user["_id"] in userIds

    def testAccessListReportsEffectiveCurrentUserLevel(
            self, admin, user, server):
        """currentUserLevel is the caller's effective level, so WRITE held
        through a group (no direct row) still lets the dialog share."""
        dataset, config, datasetView = createDatasetWithView(admin)
        group = Group().createGroup("writers", admin)
        Group().addUser(group, user, level=AccessType.READ)
        Folder().setGroupAccess(dataset, group, AccessType.WRITE, save=True)
        Collection().setGroupAccess(config, group, AccessType.READ, save=True)

        def accessOf(path, caller):
            resp = server.request(path=path, method="GET", user=caller)
            assertStatusOk(resp)
            return resp.json

        datasetPath = f"/dataset_view/access/{dataset['_id']}"
        configPath = f"/dataset_view/configuration_access/{config['_id']}"
        datasetAccess = accessOf(datasetPath, user)
        assert str(user["_id"]) not in {
            u["id"] for u in datasetAccess["users"]}
        assert datasetAccess["currentUserLevel"] == AccessType.WRITE
        assert accessOf(configPath, user)["currentUserLevel"] == (
            AccessType.READ)
        assert accessOf(datasetPath, admin)["currentUserLevel"] == (
            AccessType.ADMIN)

    def testAccessListHidesLegacyNegativeEntries(self, admin, user, server):
        """Level -1 entries left by the old share endpoint grant nothing,
        so the dataset and configuration access lists omit them."""
        dataset, config, datasetView = createDatasetWithView(admin)
        Folder().setUserAccess(dataset, user, AccessType.NONE, save=True)
        Collection().setUserAccess(config, user, AccessType.NONE, save=True)

        for path in (
            f"/dataset_view/access/{dataset['_id']}",
            f"/dataset_view/configuration_access/{config['_id']}",
        ):
            resp = server.request(path=path, method="GET", user=admin)
            assertStatusOk(resp)
            listed = {u["id"] for u in resp.json["users"]}
            assert str(user["_id"]) not in listed
            assert str(admin["_id"]) in listed

    def testAccessListShowsCorrectLevels(self, admin, user):
        """Test that access levels are correctly reported."""
        dataset, config, datasetView = createDatasetWithView(admin)

        # Share with user at READ level
        Folder().setUserAccess(dataset, user, AccessType.READ, save=True)

        # Get access list
        accessList = Folder().getFullAccessList(dataset)

        # Find user in list and check level
        userEntry = next(
            (u for u in accessList["users"] if u["id"] == user["_id"]),
            None
        )
        assert userEntry is not None
        assert userEntry["level"] == AccessType.READ

        # Admin should have ADMIN level
        adminEntry = next(
            (u for u in accessList["users"] if u["id"] == admin["_id"]),
            None
        )
        assert adminEntry is not None
        assert adminEntry["level"] == AccessType.ADMIN


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestAccessEndpointPermissions:
    """Tests that the access endpoints allow READ-level users."""

    def testDatasetAccessAsOwner(self, admin, server):
        """Owner (ADMIN) can call getDatasetAccess."""
        dataset, config, dv = createDatasetWithView(admin)

        resp = server.request(
            path=f"/dataset_view/access/{dataset['_id']}",
            method="GET",
            user=admin,
        )
        assertStatusOk(resp)
        assert resp.json["datasetId"] == str(dataset["_id"])
        assert any(
            u["id"] == str(admin["_id"]) and u["level"] == 2
            for u in resp.json["users"]
        )

    def testDatasetAccessAsReadUser(self, admin, user, server):
        """READ-level user can call getDatasetAccess."""
        dataset, config, dv = createDatasetWithView(admin)
        Folder().setUserAccess(
            dataset, user, AccessType.READ, save=True
        )

        resp = server.request(
            path=f"/dataset_view/access/{dataset['_id']}",
            method="GET",
            user=user,
        )
        assertStatusOk(resp)
        assert resp.json["datasetId"] == str(dataset["_id"])

        # Verify the response includes both users
        ids = {u["id"] for u in resp.json["users"]}
        assert str(admin["_id"]) in ids
        assert str(user["_id"]) in ids

    def testDatasetAccessDeniedWithoutAccess(
        self, admin, user, server
    ):
        """User with no access gets 403 from getDatasetAccess."""
        dataset, config, dv = createDatasetWithView(admin)
        # Make private so non-shared user can't read
        Folder().setPublic(dataset, False, save=True)

        resp = server.request(
            path=f"/dataset_view/access/{dataset['_id']}",
            method="GET",
            user=user,
        )
        assertStatus(resp, 403)

    def testConfigAccessAsOwner(self, admin, server):
        """Owner (ADMIN) can call getConfigurationAccess."""
        dataset, config, dv = createDatasetWithView(admin)

        resp = server.request(
            path=(
                "/dataset_view/configuration_access"
                f"/{config['_id']}"
            ),
            method="GET",
            user=admin,
        )
        assertStatusOk(resp)
        assert resp.json["configurationId"] == str(
            config["_id"]
        )

    def testConfigAccessAsReadUser(self, admin, user, server):
        """READ-level user can call getConfigurationAccess."""
        dataset, config, dv = createDatasetWithView(admin)
        Collection().setUserAccess(
            config, user, AccessType.READ, save=True
        )

        resp = server.request(
            path=(
                "/dataset_view/configuration_access"
                f"/{config['_id']}"
            ),
            method="GET",
            user=user,
        )
        assertStatusOk(resp)
        assert resp.json["configurationId"] == str(
            config["_id"]
        )

        ids = {u["id"] for u in resp.json["users"]}
        assert str(admin["_id"]) in ids
        assert str(user["_id"]) in ids

    def testConfigAccessDeniedWithoutAccess(
        self, admin, user, server
    ):
        """User with no access gets 403 from
        getConfigurationAccess."""
        dataset, config, dv = createDatasetWithView(admin)
        # Make private so non-shared user can't read
        Collection().setPublic(config, False, save=True)

        resp = server.request(
            path=(
                "/dataset_view/configuration_access"
                f"/{config['_id']}"
            ),
            method="GET",
            user=user,
        )
        assertStatus(resp, 403)


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestBulkFind:
    """Tests for bulk find operations using Model().find()."""

    def testFindMultipleDatasetViews(self, admin):
        """Test finding multiple dataset views in one query."""
        # Create multiple datasets with views
        dataset1, config1, view1 = createDatasetWithView(admin)
        dataset2, config2, view2 = createDatasetWithView(admin)
        dataset3, config3, view3 = createDatasetWithView(admin)

        # Bulk find by dataset IDs
        datasetIds = [dataset1["_id"], dataset2["_id"]]
        views = list(DatasetViewModel().find({
            "datasetId": {"$in": datasetIds}
        }))

        # Should find 2 views
        assert len(views) == 2
        viewDatasetIds = {v["datasetId"] for v in views}
        assert dataset1["_id"] in viewDatasetIds
        assert dataset2["_id"] in viewDatasetIds
        assert dataset3["_id"] not in viewDatasetIds

    def testFindWithPermissions(self, admin, user):
        """Test that findWithPermissions respects access control."""
        # Create dataset as admin
        dataset, config, datasetView = createDatasetWithView(admin)

        # User should NOT see it initially
        views = list(DatasetViewModel().findWithPermissions(
            {"datasetId": dataset["_id"]},
            user=user,
            level=AccessType.READ
        ))
        assert len(views) == 0

        # Share with user
        DatasetViewModel().setUserAccess(
            datasetView, user, AccessType.READ, save=True
        )

        # Now user should see it
        views = list(DatasetViewModel().findWithPermissions(
            {"datasetId": dataset["_id"]},
            user=user,
            level=AccessType.READ
        ))
        assert len(views) == 1
        assert views[0]["_id"] == datasetView["_id"]


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestFindCurrentUserOnly:
    """Tests for the currentUserOnly filter on the find endpoint."""

    def testReturnsOnlyUserOwnedViews(self, admin, user, server):
        """currentUserOnly=true returns only views the user owns.

        A view shared at READ level should NOT appear, even though it is
        readable.
        """
        # User creates one view they own
        ownDataset, ownConfig, ownView = createDatasetWithView(user)

        # Admin creates a separate view and shares it with user at READ
        sharedDataset, sharedConfig, sharedView = createDatasetWithView(
            admin
        )
        DatasetViewModel().setUserAccess(
            sharedView, user, AccessType.READ, save=True
        )
        Folder().setUserAccess(
            sharedDataset, user, AccessType.READ, save=True
        )
        Collection().setUserAccess(
            sharedConfig, user, AccessType.READ, save=True
        )

        # Without the filter: user sees both (their own + shared)
        resp = server.request(
            path="/dataset_view",
            method="GET",
            user=user,
        )
        assertStatusOk(resp)
        ids = {v["_id"] for v in resp.json}
        assert str(ownView["_id"]) in ids
        assert str(sharedView["_id"]) in ids

        # With the filter: user sees only the view they own
        resp = server.request(
            path="/dataset_view",
            method="GET",
            params={"currentUserOnly": "true"},
            user=user,
        )
        assertStatusOk(resp)
        ids = {v["_id"] for v in resp.json}
        assert str(ownView["_id"]) in ids
        assert str(sharedView["_id"]) not in ids

    def testFalsyValuesAreIgnored(self, admin, user, server):
        """currentUserOnly with a falsy value behaves like the default."""
        ownDataset, ownConfig, ownView = createDatasetWithView(user)
        sharedDataset, sharedConfig, sharedView = createDatasetWithView(
            admin
        )
        DatasetViewModel().setUserAccess(
            sharedView, user, AccessType.READ, save=True
        )
        Folder().setUserAccess(
            sharedDataset, user, AccessType.READ, save=True
        )
        Collection().setUserAccess(
            sharedConfig, user, AccessType.READ, save=True
        )

        for value in ("false", "0", "no", ""):
            resp = server.request(
                path="/dataset_view",
                method="GET",
                params={"currentUserOnly": value},
                user=user,
            )
            assertStatusOk(resp)
            ids = {v["_id"] for v in resp.json}
            assert str(ownView["_id"]) in ids, value
            assert str(sharedView["_id"]) in ids, value

    def testTruthyAliases(self, admin, user, server):
        """Multiple truthy spellings all activate the filter."""
        ownDataset, ownConfig, ownView = createDatasetWithView(user)
        sharedDataset, sharedConfig, sharedView = createDatasetWithView(
            admin
        )
        DatasetViewModel().setUserAccess(
            sharedView, user, AccessType.READ, save=True
        )
        Folder().setUserAccess(
            sharedDataset, user, AccessType.READ, save=True
        )
        Collection().setUserAccess(
            sharedConfig, user, AccessType.READ, save=True
        )

        for value in ("true", "True", "TRUE", "1", "yes", "on"):
            resp = server.request(
                path="/dataset_view",
                method="GET",
                params={"currentUserOnly": value},
                user=user,
            )
            assertStatusOk(resp)
            ids = {v["_id"] for v in resp.json}
            assert str(ownView["_id"]) in ids, value
            assert str(sharedView["_id"]) not in ids, value

    def testAdminWithFilterOnlySeesOwnViews(self, admin, user, server):
        """Site admin with currentUserOnly=true sees only what they own.

        Site admins normally see everything via findWithPermissions, but
        the filter narrows that to views where their _id appears with
        ADMIN access — i.e. things they created.
        """
        # Other user owns a view
        otherDataset, otherConfig, otherView = createDatasetWithView(user)

        # Admin owns a view
        adminDataset, adminConfig, adminView = createDatasetWithView(admin)

        resp = server.request(
            path="/dataset_view",
            method="GET",
            params={"currentUserOnly": "true"},
            user=admin,
        )
        assertStatusOk(resp)
        ids = {v["_id"] for v in resp.json}
        assert str(adminView["_id"]) in ids
        assert str(otherView["_id"]) not in ids

    def testAnonymousIgnoresFilter(self, admin, server):
        """Anonymous users have no _id; filter is skipped, returns
        whatever READ permissions allow (typically only public views).
        """
        dataset, config, datasetView = createDatasetWithView(admin)
        # Make public so anonymous can read
        Folder().setPublic(dataset, True, save=True)
        DatasetViewModel().setPublic(datasetView, True, save=True)
        Collection().setPublic(config, True, save=True)

        resp = server.request(
            path="/dataset_view",
            method="GET",
            params={"currentUserOnly": "true"},
            user=None,
        )
        assertStatusOk(resp)
        # Should not crash; returns the public view since filter is
        # skipped when no current user.
        ids = {v["_id"] for v in resp.json}
        assert str(datasetView["_id"]) in ids
