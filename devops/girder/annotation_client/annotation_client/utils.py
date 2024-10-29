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


def sendWarning(warning_message, title="Warning", info=None):
    """
    Send warning message to the front end

    :param str warning_message: The warning message to send
    :param str title: Title for the warning message
    :param str info: Additional information to send
    """
    print(
        json.dumps({"warning": warning_message, "title": title, "info": info, "type": "warning"})
    )
    sys.stdout.flush()


def sendError(error_message, title="Error", info=None):
    """
    Send error message to the front end

    :param str error_message: The error message to send
    :param str title: Title for the error message
    :param str info: Additional information to send
    """
    print(
        json.dumps({"error": error_message, "title": title, "info": info, "type": "error"})
    )
    sys.stdout.flush()
