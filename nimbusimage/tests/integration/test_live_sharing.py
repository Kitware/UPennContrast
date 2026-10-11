"""Integration tests for dataset sharing.

The unit tests pin the request bodies; these prove the server accepts
them and that access actually changes for another, non-admin user.
"""

import secrets

import girder_client
import pytest

import nimbusimage as ni

pytestmark = pytest.mark.integration


@pytest.fixture
def second_user(client, api_url):
    """A temporary non-admin user, deleted afterwards.

    Yields ``(login, ni.NimbusClient)`` with the client authenticated as
    that user.
    """
    login = f"ni-share-test-{secrets.token_hex(4)}"
    password = secrets.token_urlsafe(16)
    user = client.girder.post(
        "user",
        data={
            "login": login,
            "email": f"{login}@example.com",
            "firstName": "Share",
            "lastName": "Test",
            "password": password,
            "admin": "false",
        },
    )
    try:
        assert not user["admin"]
        yield login, ni.connect(api_url, username=login, password=password)
    finally:
        client.girder.delete(f"user/{user['_id']}")


def _can_read(other_client, dataset_id):
    try:
        other_client.girder.get(f"folder/{dataset_id}")
    except girder_client.HttpError as error:
        if error.status in (401, 403):
            return False
        raise
    return True


def _user_levels(ds):
    return {u["login"]: u["level"] for u in ds.sharing.get_access()["users"]}


def _has_no_grant(ds, login):
    # "remove" sends accessType -1, which the server currently stores as
    # a level -1 entry rather than deleting it; either way the user holds
    # no READ-or-better grant.
    return _user_levels(ds).get(login, -1) < 0


class TestLiveSharing:
    def test_share_read_then_remove(self, private_test_dataset, second_user):
        ds = private_test_dataset
        login, other = second_user
        views = other.girder.get(
            "dataset_view", parameters={"datasetId": ds.id, "limit": 0}
        )
        assert views == []
        assert not _can_read(other, ds.id)

        ds.sharing.share(login, access="read")

        assert _user_levels(ds)[login] == 0
        assert _can_read(other, ds.id)
        assert other.dataset(ds.id).id == ds.id
        # The view and its collection are shared too, so the dataset
        # opens in the web app with its configuration.
        views = other.girder.get(
            "dataset_view", parameters={"datasetId": ds.id, "limit": 0}
        )
        assert len(views) == 1
        other.girder.get(f"upenn_collection/{views[0]['configurationId']}")

        ds.sharing.share(login, access="remove")

        assert _has_no_grant(ds, login)
        assert not _can_read(other, ds.id)

    @pytest.mark.parametrize("access, level", [("write", 1), ("admin", 2)])
    def test_share_higher_levels(
        self, private_test_dataset, second_user, access, level
    ):
        ds = private_test_dataset
        login, other = second_user

        ds.sharing.share(login, access=access)
        assert _user_levels(ds)[login] == level
        folder = other.girder.get(f"folder/{ds.id}")
        assert folder["_accessLevel"] == level

        ds.sharing.share(login, access="remove")
        assert _has_no_grant(ds, login)

    def test_set_public_round_trip(self, private_test_dataset, second_user):
        ds = private_test_dataset
        _, other = second_user

        result = ds.sharing.set_public(True)
        assert result["public"] is True
        assert result["datasetViewsUpdated"] == 1
        assert ds.sharing.get_access()["public"] is True
        assert _can_read(other, ds.id)

        ds.sharing.set_public(False)
        assert ds.sharing.get_access()["public"] is False
        assert not _can_read(other, ds.id)

    def test_share_refuses_to_target_caller(
        self, private_test_dataset, client
    ):
        ds = private_test_dataset
        me = client.girder.get("user/me")

        with pytest.raises(ValueError, match="your own access"):
            ds.sharing.share(me["login"], access="remove")

        assert _user_levels(ds)[me["login"]] == 2


@pytest.fixture
def private_project(client, private_test_dataset):
    """A temporary project holding ``private_test_dataset``."""
    project = client.create_project(
        f"ni-share-test-project-{secrets.token_hex(4)}"
    )
    try:
        project.add_dataset(private_test_dataset.id)
        yield project, private_test_dataset
    finally:
        project.delete()


class TestLiveProjectSharing:
    def test_share_read_then_remove(self, private_project, second_user):
        project, ds = private_project
        login, other = second_user
        assert not _can_read(other, ds.id)

        project.share(login, access="read")

        users = project.get_access()["users"]
        assert {u["login"]: u["level"] for u in users}[login] == 0
        assert other.project(project.id).id == project.id
        # Project sharing propagates to the datasets it contains.
        assert _can_read(other, ds.id)

        project.share(login, access="remove")

        assert not _can_read(other, ds.id)

    def test_set_public_round_trip(self, private_project, second_user):
        project, ds = private_project
        _, other = second_user

        assert project.set_public(True)["public"] is True
        assert project.get_access()["public"] is True
        assert _can_read(other, ds.id)

        assert project.set_public(False)["public"] is False
        assert not _can_read(other, ds.id)

    def test_share_refuses_to_target_caller(self, private_project, client):
        project, _ = private_project
        me = client.girder.get("user/me")

        with pytest.raises(ValueError, match="your own access"):
            project.share(me["email"], access="remove")
