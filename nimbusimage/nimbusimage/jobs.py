"""Job tracking for worker computations."""

from __future__ import annotations

import json
import re
import sys
import time

import girder_client

# Girder tokens and API keys: 40+ mixed-case letters and digits. A worker
# job's log starts with its launch command, which carries a live Girder
# token; Job.log never includes it. (Hex digests are lower-case, so kept.)
_SECRET = re.compile(
    r"(?<![A-Za-z0-9])(?=[A-Za-z0-9]*[A-Z])(?=[A-Za-z0-9]*[a-z])"
    r"[A-Za-z0-9]{40,}(?![A-Za-z0-9])"
)

# GET job/{id} accepts a custom-scoped key only if it carries
# jobs.rest.list_job ("List and read jobs" in Girder's API key dialog). A key
# without it can still submit jobs, which then run, but gets a 401 whose raw
# message misattributes the cause (NIM-005).
_JOB_SCOPE_HINT = (
    "Could not read job status (HTTP 401). Your API key is most likely "
    "missing the 'List and read jobs' permission, so it can submit jobs but "
    "cannot poll their status or logs. The job itself is not affected and "
    "may still be running. Add 'List and read jobs' to the key if you can "
    "edit it, or ask the server's admin (support, for nimbusimage.com) to "
    "add it. A full-access key ('Allow all actions on behalf of my user') "
    "also works. See the nimbusimage README (Authentication)."
)

# The same 401 comes back when no valid token reached the server at all
# (expired, or its API key was revoked or deactivated). Girder's message
# then lists no allowed scopes ("Allowed: " is empty), unlike a valid
# custom-scoped token, which lists the scopes it has.
_JOB_TOKEN_HINT = (
    "Could not read job status (HTTP 401). The server did not accept this "
    "session's token: it may have expired, or the API key may have been "
    "revoked or deactivated. The job itself is not affected. Reconnect, and "
    "check that the API key is still active."
)


def _token_was_rejected(exc: girder_client.HttpError) -> bool:
    """True when a 401's Girder message lists no allowed scopes."""
    try:
        message = json.loads(exc.responseText)["message"]
    except (TypeError, ValueError, KeyError):
        return False
    return re.search(r"Allowed:\s*$", message) is not None


def _log_text(job_data: dict) -> str:
    """A job document's log as one string, with Girder tokens redacted.
    girder_jobs returns the log inside GET job/{id}; there is no separate
    job/{id}/log route."""
    log = job_data.get("log") or []
    log = "".join(log) if isinstance(log, list) else str(log)
    return _SECRET.sub("[redacted]", log)


def _fetch_job(gc: girder_client.GirderClient, job_id: str) -> dict:
    """GET job/{id}, turning a 401 into a PermissionError that names the
    likely cause instead of Girder's raw scope message."""
    try:
        return gc.get(f"job/{job_id}")
    except girder_client.HttpError as exc:
        if getattr(exc, "status", None) == 401:
            hint = (
                _JOB_TOKEN_HINT if _token_was_rejected(exc)
                else _JOB_SCOPE_HINT
            )
            raise PermissionError(hint) from exc
        raise


# Girder job status codes
STATUS_INACTIVE = 0
STATUS_QUEUED = 1
STATUS_RUNNING = 2
STATUS_SUCCESS = 3
STATUS_ERROR = 4
STATUS_CANCELLED = 5

_STATUS_NAMES = {
    STATUS_INACTIVE: "inactive",
    STATUS_QUEUED: "queued",
    STATUS_RUNNING: "running",
    STATUS_SUCCESS: "success",
    STATUS_ERROR: "error",
    STATUS_CANCELLED: "cancelled",
}

_TERMINAL = {STATUS_SUCCESS, STATUS_ERROR, STATUS_CANCELLED}


class Job:
    """A running or completed worker job.

    Tracks a Girder Worker job by polling its status. Use ``wait()``
    to block until the job finishes, optionally printing progress.
    """

    def __init__(self, gc: girder_client.GirderClient, job_data: dict):
        self._gc = gc
        self._id = job_data["_id"]
        self._data = job_data
        self._log = _log_text(job_data)

    @classmethod
    def fetch(cls, gc: girder_client.GirderClient, job_id: str) -> Job:
        """Load a job by id. Raises PermissionError on a 401, like
        :meth:`refresh`."""
        return cls(gc, _fetch_job(gc, job_id))

    @property
    def id(self) -> str:
        """The Girder job ID."""
        return self._id

    @property
    def status(self) -> int:
        """Current status code. Call refresh() to update."""
        return self._data.get("status", STATUS_INACTIVE)

    @property
    def status_name(self) -> str:
        """Human-readable status name."""
        return _STATUS_NAMES.get(self.status, f"unknown({self.status})")

    @property
    def title(self) -> str:
        return self._data.get("title", "")

    @property
    def log(self) -> str:
        """Full job log text, with Girder tokens replaced by
        ``[redacted]``. Call refresh() to update."""
        return self._log

    @property
    def finished(self) -> bool:
        return self.status in _TERMINAL

    @property
    def succeeded(self) -> bool:
        return self.status == STATUS_SUCCESS

    def refresh(self) -> None:
        """Fetch the latest job status and log from the server.

        Raises:
            PermissionError: If the job-status request returns 401. The
                message says whether the API key lacks the 'List and read
                jobs' scope (NIM-005) or the token itself was not accepted
                (expired, or its key revoked). The job itself is
                unaffected.
        """
        self._data = _fetch_job(self._gc, self._id)
        self._log = _log_text(self._data)

    def wait(
        self,
        poll_interval: float = 2.0,
        timeout: float | None = None,
        verbose: bool = True,
    ) -> bool:
        """Block until the job finishes.

        Args:
            poll_interval: Seconds between status polls.
            timeout: Max seconds to wait. None = no limit.
            verbose: If True, print status updates to stderr.

        Returns:
            True if the job succeeded, False otherwise.

        Raises:
            TimeoutError: If timeout is reached before the job finishes.
            PermissionError: If polling returns 401; see :meth:`refresh`.
        """
        start = time.monotonic()
        last_log_len = 0

        while True:
            self.refresh()

            if verbose:
                # Print any new log lines
                if len(self._log) > last_log_len:
                    new_text = self._log[last_log_len:]
                    print(new_text, end="", file=sys.stderr, flush=True)
                    last_log_len = len(self._log)

            if self.finished:
                if verbose:
                    print(
                        f"\nJob {self.status_name}: {self.title}",
                        file=sys.stderr,
                        flush=True,
                    )
                return self.succeeded

            if timeout is not None:
                elapsed = time.monotonic() - start
                if elapsed >= timeout:
                    raise TimeoutError(
                        f"Job {self._id} did not finish within "
                        f"{timeout}s (status: {self.status_name})"
                    )

            time.sleep(poll_interval)
