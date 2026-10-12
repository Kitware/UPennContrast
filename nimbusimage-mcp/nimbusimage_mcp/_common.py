"""Plumbing shared by every tool: the caller's client, error mapping,
compact results, and the call log."""

from __future__ import annotations

import functools
import json
import logging
import math
import time

import girder_client
import requests
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.mcpserver import Image
from mcp.server.mcpserver.exceptions import ToolError
from mcp_types import ToolAnnotations

import nimbusimage as ni

from nimbusimage_mcp.config import Settings

log = logging.getLogger("nimbusimage_mcp.calls")

READ_ONLY = ToolAnnotations(readOnlyHint=True, openWorldHint=False)
# Changes stored data; clients should ask the user first.
WRITES = ToolAnnotations(
    readOnlyHint=False, destructiveHint=True, idempotentHint=False,
    openWorldHint=False,
)

_settings: Settings | None = None


def configure(settings: Settings) -> None:
    global _settings
    _settings = settings


def settings() -> Settings:
    if _settings is None:
        raise RuntimeError("nimbusimage_mcp is not configured")
    return _settings


def client() -> ni.NimbusClient:
    """A nimbusimage client acting as the caller, from this request's
    verified token. There is no fallback credential."""
    access = get_access_token()
    if access is None or not (access.claims or {}).get("girder_token"):
        # Unreachable behind the auth middleware; a guard against ever
        # serving a request without a caller.
        raise ToolError("Not authenticated.")
    return ni.connect(settings().api_url, token=access.claims["girder_token"])


def caller_id() -> str | None:
    access = get_access_token()
    return access.subject if access else None


def compact(result) -> str | Image:
    """Tool results go out as compact JSON text. The SDK would indent dict
    results (about a third more bytes, measured in the spike)."""
    if isinstance(result, (str, Image)):
        return result
    return json.dumps(result, separators=(",", ":"), default=str)


def result_size(result) -> int:
    """Bytes on the wire: images travel base64-encoded, text as is."""
    if isinstance(result, Image):
        return 4 * math.ceil(len(result.data or b"") / 3)
    return len(result.encode())


def girder_message(e: girder_client.HttpError) -> str:
    try:
        return json.loads(e.responseText).get("message", "")
    except (ValueError, AttributeError):
        return ""


def tool_error(e: girder_client.HttpError) -> ToolError:
    if e.status == 401:
        # The verifier checked this session at the start of the request,
        # so the likeliest cause is a scoped API key lacking the scope
        # this call needs (e.g. help topics and job status need
        # core.user_auth), not an expired session.
        return ToolError(
            "NimbusImage refused this call with your API key (HTTP 401). "
            "If the key was created with limited scopes, this call needs "
            "a scope it lacks; a full-access key works. Otherwise the key "
            "was just revoked."
        )
    if e.status == 403:
        return ToolError(
            "Access denied: you do not have permission for this. "
            f"{girder_message(e)}".strip()
        )
    if e.status == 400:
        # Girder answers 400, not 404, for an id that matches no folder.
        return ToolError(f"Invalid request: {girder_message(e)}")
    if e.status == 404:
        return ToolError(f"Not found. {girder_message(e)}".strip())
    return ToolError(f"NimbusImage server error ({e.status}).")


def instrumented(fn):
    """Map Girder errors to tool errors, return compact JSON, and log the
    tool, caller, duration, and wire size. Never logs credentials."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        error = None
        result = None
        succeeded = False
        try:
            result = compact(fn(*args, **kwargs))
            succeeded = True
            return result
        except ToolError as e:
            error = str(e)
            raise
        except girder_client.HttpError as e:
            error = f"HTTP {e.status}"
            raise tool_error(e) from None
        except requests.ConnectionError:
            error = "connection"
            raise ToolError("Could not reach the NimbusImage server.") \
                from None
        except (ValueError, PermissionError) as e:
            # nimbusimage reports bad input as ValueError ("No large image
            # found in dataset ...") and a key scope problem as
            # PermissionError; both messages are meant for the user.
            error = str(e)
            raise ToolError(str(e)) from None
        finally:
            record = {
                "ts": round(time.time(), 3),
                "tool": fn.__name__,
                "user": caller_id(),
                "args": kwargs,
                "seconds": round(time.perf_counter() - start, 3),
                "bytes": result_size(result) if succeeded else None,
                # "unhandled": not one of the mapped errors; the SDK
                # reports it to the client.
                "error": None if succeeded else (error or "unhandled"),
            }
            line = json.dumps(record, default=str)
            log.info(line)
            call_log = _settings.call_log if _settings else None
            if call_log:
                with open(call_log, "a") as f:
                    f.write(line + "\n")

    return wrapper


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(value, high))


def round_sig(value, digits: int = 4):
    """Round a statistic for display; None and non-finite pass through."""
    if value is None or not isinstance(value, (int, float)) \
            or not math.isfinite(value) or value == 0:
        return value
    return round(value, digits - 1 - int(math.floor(math.log10(abs(value)))))
