"""Server settings, read once from the environment.

The server holds no NimbusImage credential of its own: every request
brings the caller's API key (see auth.py). That is why there is no
NI_API_KEY here, and why the server refuses to start with one set (the
nimbusimage package would otherwise fall back to it silently).
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Girder REST root the server calls, e.g. http://girder:8080/api/v1 in
    # compose. Not necessarily what clients can reach.
    api_url: str
    # This server's public MCP URL: the OAuth resource identifier and the
    # base of /.well-known/oauth-protected-resource.
    public_url: str
    # Advertised as the authorization server in the protected resource
    # metadata. Phase 1 has no OAuth server; this is Girder's public root.
    issuer_url: str
    host: str = "127.0.0.1"
    port: int = 8000
    # Optional JSON-lines call log (tool, user, seconds, bytes, error).
    call_log: str | None = None
    # ni_job_wait's longest wait. Must stay below every HTTP timeout
    # between the client and this server (client, HAProxy).
    max_job_wait: float = 240.0

    @classmethod
    def from_env(cls, environ=os.environ) -> "Settings":
        if environ.get("NI_API_KEY") or environ.get("NI_TOKEN"):
            raise ValueError(
                "NI_API_KEY / NI_TOKEN must not be set for the MCP server: "
                "it acts only as each caller, with their own key."
            )
        port = int(environ.get("NI_MCP_PORT", "8000"))
        max_job_wait = float(environ.get("NI_MCP_MAX_JOB_WAIT", "240"))
        if max_job_wait < 1:
            raise ValueError("NI_MCP_MAX_JOB_WAIT must be at least 1 second.")
        host = environ.get("NI_MCP_HOST", "127.0.0.1")
        return cls(
            api_url=environ.get(
                "NI_API_URL", "http://localhost:8080/api/v1"
            ),
            public_url=environ.get(
                "NI_MCP_PUBLIC_URL", f"http://localhost:{port}/mcp"
            ),
            issuer_url=environ.get(
                "NI_MCP_ISSUER_URL", "http://localhost:8080"
            ),
            host=host,
            port=port,
            call_log=environ.get("NI_MCP_CALL_LOG") or None,
            max_job_wait=max_job_wait,
        )
