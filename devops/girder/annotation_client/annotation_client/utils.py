import sys
import json


def sendProgress(progress, title, info):
    """
    Send progress to the front end

    :param float progress: Progress between 0 and 1 for the linear progress bar
    :param str title: Text to show in bold in the progress bar
    :param str info: Text to show after the title in the progress bar
    """
    print(json.dumps({"progress": progress, "title": title, "info": info}))
    sys.stdout.flush()
