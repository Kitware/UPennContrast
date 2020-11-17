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
