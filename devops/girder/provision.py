import argparse
import sys

from girder.models.assetstore import Assetstore
from girder.models.setting import Setting
from girder.models.user import User
from girder.utility.server import configureServer


def provision(opts):
    """
    Provision the instance.

    :param opts: the argparse options.
    """
    # If there is are no users, create an admin user
    if User().findOne() is None:
        User().createUser('admin', 'password', 'Admin', 'Admin', 'admin@nowhere.nil')
        # Allow cross origin requests, but since this may be undesired,
        # only do it if we are creating an admin user so it doesn't happen
        # on subsequent starts.
        Setting().set('core.cors.allow_origin', '*')

    # Make sure we have an assetstore
    if Assetstore().findOne() is None:
        Assetstore().createFilesystemAssetstore('Assetstore', '/assetstore')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Provision a girder instance')
    opts = parser.parse_args(args=sys.argv[1:])
    # This loads plugins, allowing setting validation
    configureServer()
    provision(opts)
