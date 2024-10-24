import argparse
import os
import sys

from girder.models.assetstore import Assetstore
from girder.models.setting import Setting
from girder.models.user import User
from girder.utility.server import configureServer

assetstoreName = "Assetstore"


def provision(opts):
    """
    Provision the instance.

    :param opts: the argparse options.
    """
    # If there is are no users, create an admin user
    if User().findOne() is None:
        User().createUser(
            "admin", "password", "Admin", "Admin", "admin@nowhere.nil"
        )
        # Allow cross origin requests, but since this may be undesired,
        # only do it if we are creating an admin user so it doesn't happen
        # on subsequent starts.
        Setting().set("core.cors.allow_origin", "http://localhost:*")

        # Increase the allowed files that can be cached, as this is used for
        # tiled frames
        Setting().set("large_image.max_thumbnail_files", 400)

        # This is how the worker addresses the server.  If the worker is on a
        # separate machine, this would need to change
        Setting().set("worker.api_url", "http://girder:8080/api/v1")

    # Make sure we have an assetstore
    if Assetstore().findOne() is None:
        if "S3_BUCKET_NAME" in os.environ:
            if "S3_BUCKET_ACCESS_KEY" not in os.environ \
                 or "S3_BUCKET_SECRET" not in os.environ:
                raise ValueError(
                    "Cannot create S3 assetstore: S3_BUCKET_ACCESS_KEY or "
                    "S3_BUCKET_SECRET missing.")
            Assetstore().createS3Assetstore(
                assetstoreName, os.environ.get("S3_BUCKET_NAME"),
                os.environ.get("S3_BUCKET_ACCESS_KEY"),
                os.environ.get("S3_BUCKET_SECRET"), region="us-east-1",
                serverSideEncryption=True)
        else:
            Assetstore().createFilesystemAssetstore(
                assetstoreName, "/assetstore")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Provision a girder instance")
    opts = parser.parse_args(args=sys.argv[1:])
    # This loads plugins, allowing setting validation
    configureServer()
    provision(opts)
