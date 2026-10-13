"""Tests for dataset sharing functionality.

Tests the share, setDatasetPublic, and getDatasetAccess endpoints
in the DatasetView API.
"""
import json

import pytest
from bson import ObjectId
import random

from pytest_girder.assertions import assertStatus, assertStatusOk

from girder.constants import AccessType
from girder.exceptions import AccessException
from girder.models.folder import Folder
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
        """Test removing access using -1 (Girder convention)."""
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

        # Remove access using -1
        DatasetViewModel().setUserAccess(
            datasetView, user, -1, save=True
        )
        Folder().setUserAccess(
            dataset, user, -1, save=True
        )

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


def createOtherUser():
    return User().createUser(
        email="other@girder.test", login="other", firstName="Other",
        lastName="User", password="password", admin=False,
    )


def createViewWithOwnConfig(creator, dataset):
    """`creator` opens someone else's dataset with their own configuration,
    stored in their own folder."""
    folder = utilities.createPrivateFolder(
        creator, f"config_home_{random.random()}", {}
    )
    config = Collection().createCollection(
        name=f"own_config_{random.random()}",
        creator=creator,
        folder=folder,
        metadata={
            "subtype": "contrastDataset", "compatibility": {}, "layers": [],
            "tools": [], "propertyIds": [], "snapshots": [], "scales": {},
        },
    )
    view = DatasetViewModel().create(creator, {
        "datasetId": dataset["_id"],
        "configurationId": config["_id"],
        "lastLocation": {"xy": 0, "z": 0, "time": 0},
        "layerContrasts": {},
    })
    return config, view


def isPublic(model, doc):
    return model.load(doc["_id"], force=True).get("public", False)


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestSetDatasetPublicOwnership:
    """POST /dataset_view/set_public changes only what the caller owns."""

    def _setPublic(self, server, user, dataset, public):
        resp = server.request(
            path="/dataset_view/set_public", method="POST", user=user,
            params={"datasetId": str(dataset["_id"]),
                    "public": json.dumps(public)},
        )
        assertStatusOk(resp)
        return resp.json

    def testChangesOnlyOwnViewsAndConfigurations(self, user, server):
        # user (not a site admin) owns the dataset and one view/config.
        dataset, ownConfig, ownView = createDatasetWithView(user)
        Folder().setPublic(dataset, False, save=True)
        Collection().setPublic(ownConfig, False, save=True)
        # other can read the dataset and opened it with their own config.
        other = createOtherUser()
        Folder().setUserAccess(dataset, other, AccessType.READ, save=True)
        otherConfig, otherView = createViewWithOwnConfig(other, dataset)

        result = self._setPublic(server, user, dataset, True)

        assert isPublic(Folder(), dataset)
        assert isPublic(DatasetViewModel(), ownView)
        assert isPublic(Collection(), ownConfig)
        assert not isPublic(Collection(), otherConfig)
        assert not isPublic(DatasetViewModel(), otherView)
        assert result["datasetViewsUpdated"] == 1
        assert result["configurationsUpdated"] == 1
        assert result["datasetViewsSkipped"] == 1
        assert result["configurationsSkipped"] == 1

        # Making it private does not unpublish other's view or
        # configuration either: other may publish that configuration for a
        # public dataset of their own, which unpublishing it would break.
        Collection().setPublic(
            Collection().load(otherConfig["_id"], force=True), True,
            save=True,
        )
        DatasetViewModel().setPublic(
            DatasetViewModel().load(otherView["_id"], force=True), True,
            save=True,
        )
        result = self._setPublic(server, user, dataset, False)

        assert not isPublic(Folder(), dataset)
        assert not isPublic(Collection(), ownConfig)
        assert not isPublic(DatasetViewModel(), ownView)
        assert isPublic(Collection(), otherConfig)
        assert isPublic(DatasetViewModel(), otherView)
        assert result["datasetViewsUpdated"] == 1
        assert result["configurationsUpdated"] == 1
        assert result["datasetViewsSkipped"] == 1
        assert result["configurationsSkipped"] == 1

    def testAlreadyPublicResourcesAreNotCountedAsSkipped(self, user, server):
        """Another user's view/configuration that is already public needed
        nothing, so the dialog must not say it stayed private."""
        dataset, _, _ = createDatasetWithView(user)
        other = createOtherUser()
        Folder().setUserAccess(dataset, other, AccessType.READ, save=True)
        otherConfig, otherView = createViewWithOwnConfig(other, dataset)
        Collection().setPublic(otherConfig, True, save=True)
        DatasetViewModel().setPublic(otherView, True, save=True)
        privateConfig, _ = createViewWithOwnConfig(other, dataset)

        result = self._setPublic(server, user, dataset, True)

        assert result["configurationsSkipped"] == 1
        assert result["datasetViewsSkipped"] == 1
        assert not isPublic(Collection(), privateConfig)

    def testDeletedConfigurationIsNotCountedAsSkipped(self, user, server):
        dataset, _, view = createDatasetWithView(user)
        # A view can outlive its configuration.
        DatasetViewModel().update(
            {"_id": view["_id"]},
            {"$set": {"configurationId": ObjectId()}},
        )

        result = self._setPublic(server, user, dataset, True)

        assert result["configurationsUpdated"] == 0
        assert result["configurationsSkipped"] == 0

    def testSiteAdminStillChangesEverything(self, admin, user, server):
        dataset, ownConfig, _ = createDatasetWithView(user)
        Folder().setUserAccess(dataset, admin, AccessType.READ, save=True)
        other = createOtherUser()
        Folder().setUserAccess(dataset, other, AccessType.READ, save=True)
        otherConfig, _ = createViewWithOwnConfig(other, dataset)

        result = self._setPublic(server, admin, dataset, True)

        assert isPublic(Collection(), ownConfig)
        assert isPublic(Collection(), otherConfig)
        assert result["configurationsSkipped"] == 0


@pytest.mark.usefixtures("unbindLargeImage", "unbindAnnotation")
@pytest.mark.plugin("upenncontrast_annotation")
class TestDatasetViewBodyAllowlist:
    """Create/update save only the view's own fields, never its ACL."""

    def testWriteUserCannotRewriteTheAcl(self, admin, user, server):
        _, _, view = createDatasetWithView(admin)
        view = DatasetViewModel().setUserAccess(
            view, user, AccessType.WRITE, save=True
        )

        resp = server.request(
            path="/dataset_view/%s" % view["_id"], method="PUT", user=user,
            body=json.dumps({
                "lastLocation": {"xy": 0, "z": 2, "time": 0},
                "scales": {"pixelSize": {"value": 1, "unit": "um"}},
                "lastViewed": 1760000000000,
                "access": {"users": [
                    {"id": str(user["_id"]), "level": 2, "flags": []},
                ], "groups": []},
                "public": True,
                "id": str(view["_id"]),
                "_accessLevel": 2,
            }),
            type="application/json",
        )

        assertStatusOk(resp)
        saved = DatasetViewModel().load(view["_id"], force=True)
        assert DatasetViewModel().getAccessLevel(saved, user) == \
            AccessType.WRITE
        assert saved["access"] == view["access"]
        assert not saved.get("public", False)
        assert "id" not in saved and "_accessLevel" not in saved
        # The fields the client saves still land.
        assert saved["lastLocation"] == {"xy": 0, "z": 2, "time": 0}
        assert saved["scales"] == {"pixelSize": {"value": 1, "unit": "um"}}
        assert saved["lastViewed"] == 1760000000000

    def testCreateIgnoresAclFields(self, admin, user, server):
        dataset, config, _ = createDatasetWithView(user)

        resp = server.request(
            path="/dataset_view", method="POST", user=user,
            body=json.dumps({
                "datasetId": str(dataset["_id"]),
                "configurationId": str(config["_id"]),
                "lastLocation": {"xy": 0, "z": 0, "time": 0},
                "layerContrasts": {},
                "access": {"users": [
                    {"id": str(admin["_id"]), "level": 2, "flags": []},
                ], "groups": []},
                "public": True,
            }),
            type="application/json",
        )

        assertStatusOk(resp)
        saved = DatasetViewModel().load(resp.json["_id"], force=True)
        assert [u["id"] for u in saved["access"]["users"]] == [user["_id"]]
        assert not saved.get("public", False)

    def testCreateValidatesAndChecksBothIds(self, admin, user, server):
        dataset, config, _ = createDatasetWithView(user)
        privateDataset, privateConfig, _ = createDatasetWithView(admin)
        Folder().setPublic(privateDataset, False, save=True)
        Collection().setPublic(privateConfig, False, save=True)

        def create(**ids):
            return server.request(
                path="/dataset_view", method="POST", user=user,
                body=json.dumps({
                    "lastLocation": {"xy": 0, "z": 0, "time": 0},
                    "layerContrasts": {}, **ids,
                }),
                type="application/json",
            )

        resp = create(configurationId=str(config["_id"]))
        assertStatus(resp, 400)
        assert "datasetId is required" in resp.json["message"]
        resp = create(datasetId=str(dataset["_id"]), configurationId="bad")
        assertStatus(resp, 400)
        assert "configurationId is not a valid id" in resp.json["message"]
        # Ids the caller cannot read.
        assertStatus(create(
            datasetId=str(privateDataset["_id"]),
            configurationId=str(config["_id"]),
        ), 403)
        assertStatus(create(
            datasetId=str(dataset["_id"]),
            configurationId=str(privateConfig["_id"]),
        ), 403)
        assertStatusOk(create(
            datasetId=str(dataset["_id"]),
            configurationId=str(config["_id"]),
        ))

    def testAclSavesAcceptOlderNullFields(self, admin, user, server):
        """Saves outside create/update validate the stored document as is;
        an older view holding null scales/lastViewed must still save."""
        dataset, _, view = createDatasetWithView(admin)
        DatasetViewModel().update(
            {"_id": view["_id"]},
            {"$set": {"lastViewed": None, "scales": None}},
        )
        view = DatasetViewModel().load(view["_id"], force=True)

        DatasetViewModel().setUserAccess(
            view, user, AccessType.READ, save=True
        )
        resp = server.request(
            path="/dataset_view/set_public", method="POST", user=admin,
            params={"datasetId": str(dataset["_id"]), "public": "true"},
        )

        assertStatusOk(resp)
        assert resp.json["datasetViewsUpdated"] == 1
        assert isPublic(DatasetViewModel(), view)

    def testNonObjectBodyIsRejected(self, admin, server):
        _, _, view = createDatasetWithView(admin)

        resp = server.request(
            path="/dataset_view/%s" % view["_id"], method="PUT", user=admin,
            body=json.dumps(["not", "an", "object"]),
            type="application/json",
        )

        assertStatus(resp, 400)
        assert "must be a JSON object" in resp.json["message"]
