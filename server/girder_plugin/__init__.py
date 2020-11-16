import os
import sys
from pathlib import Path
from typing import Optional, Tuple

from girder import events, plugin
from girder.models.setting import Setting

from .client_webroot import ClientWebroot

class GirderPlugin(plugin.GirderPlugin):
    def load(self, info):
        # Relocate Girder
        info["serverRoot"], info["serverRoot"].girder = (
            ClientWebroot(),
            info["serverRoot"],
        )
        info["serverRoot"].api = info["serverRoot"].girder.api

        # Create dependency on worker
        # plugin.getPlugin('worker').load(info)
        # Setting().set(
        #     'worker.api_url',
        #     os.environ.get('WORKER_API_URL', 'http://girder:8080/api/v1'),
        # )
        # Setting().set(
        #     'worker.broker',
        #     os.environ.get('CELERY_BROKER_URL', 'amqp://guest:guest@rabbit/'),
        # )
        # Setting().set(
        #     'worker.backend',
        #     os.environ.get('CELERY_BROKER_URL', 'amqp://guest:guest@rabbit/'),
        # )
