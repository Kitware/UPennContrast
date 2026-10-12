"""Bearer API key -> Girder session token, as an MCP TokenVerifier.

Plan: codebaseDocumentation/NIMBUSIMAGE_MCP_SERVER.md §6.1-6.2.

A client sends ``Authorization: Bearer <Girder API key>``. The verifier
exchanges the key for a Girder session token (``POST api_key/token``)
and caches it by SHA-256 of the key, so a user mints one Girder token
per key rather than one per call (each exchange creates a token
document and counts toward the authenticated-users metric).

A cached token is still checked against Girder on every request
(``GET token/current``, one small read). That check is what makes a
deleted or deactivated API key stop working at once: Girder removes the
key's tokens, the check fails, the re-exchange is refused, and the
request gets 401.

Neither the key nor the session token is ever logged. The key itself is
not kept: the cache is keyed by its hash, and AccessToken.token holds
that hash.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime

import httpx
from mcp.server.auth.provider import AccessToken

log = logging.getLogger(__name__)

# Re-exchange this long before the session token expires, so a token
# never lapses in the middle of a tool call.
REFRESH_MARGIN_SECONDS = 3600
# Bounds memory if many distinct keys are seen; least recently used go.
MAX_CACHED_KEYS = 10_000
# Girder API keys are 40 alphanumeric characters; anything far outside
# that is not worth a round trip to Girder.
MAX_KEY_LENGTH = 256
CLIENT_ID = "girder-api-key"


@dataclass
class _Session:
    girder_token: str
    expires_at: float  # epoch seconds
    user_id: str
    login: str


def _key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _plausible_key(key: str) -> bool:
    return 0 < len(key) <= MAX_KEY_LENGTH and key.isascii() \
        and key.isalnum()


class GirderApiKeyVerifier:
    """Resolve a Girder API key to the caller's Girder session.

    ``verify_token`` returns None (the SDK answers 401) for a key Girder
    refuses. A Girder outage or 5xx raises instead, so it surfaces as a
    server error rather than as "your key is wrong".
    """

    def __init__(
        self,
        api_url: str,
        resource_url: str,
        http: httpx.AsyncClient | None = None,
    ):
        self._api_url = api_url.rstrip("/")
        self._resource_url = resource_url
        self._http = http or httpx.AsyncClient(timeout=30)
        self._cache: OrderedDict[str, _Session] = OrderedDict()
        # Serializes exchanges only; the per-request check runs unlocked.
        self._exchange_lock = asyncio.Lock()

    async def verify_token(self, token: str) -> AccessToken | None:
        if not _plausible_key(token):
            return None
        key_hash = _key_hash(token)
        session = self._fresh(key_hash)
        if session is not None:
            if await self._still_valid(session):
                return self._access_token(key_hash, session)
            self._cache.pop(key_hash, None)
        async with self._exchange_lock:
            # Another request may have exchanged this key while we waited.
            session = self._fresh(key_hash)
            if session is None:
                session = await self._exchange(token)
                if session is None:
                    return None
                self._remember(key_hash, session)
        return self._access_token(key_hash, session)

    def _fresh(self, key_hash: str) -> _Session | None:
        session = self._cache.get(key_hash)
        if session is None:
            return None
        if session.expires_at - REFRESH_MARGIN_SECONDS <= time.time():
            self._cache.pop(key_hash, None)
            return None
        self._cache.move_to_end(key_hash)
        return session

    def _remember(self, key_hash: str, session: _Session) -> None:
        self._cache[key_hash] = session
        self._cache.move_to_end(key_hash)
        while len(self._cache) > MAX_CACHED_KEYS:
            self._cache.popitem(last=False)

    async def _exchange(self, key: str) -> _Session | None:
        response = await self._http.post(
            f"{self._api_url}/api_key/token", data={"key": key}
        )
        if response.status_code in (400, 401, 403):
            # Girder answers 400 "Invalid API key." for unknown, inactive,
            # and deleted keys alike.
            log.info("API key exchange refused (%d)", response.status_code)
            return None
        response.raise_for_status()
        body = response.json()
        auth = body["authToken"]
        user = body.get("user") or {}
        return _Session(
            girder_token=auth["token"],
            expires_at=datetime.fromisoformat(auth["expires"]).timestamp(),
            user_id=str(user.get("_id", "")),
            login=str(user.get("login", "")),
        )

    async def _still_valid(self, session: _Session) -> bool:
        response = await self._http.get(
            f"{self._api_url}/token/current",
            headers={"Girder-Token": session.girder_token},
        )
        if response.status_code == 401:
            return False
        response.raise_for_status()
        # Girder answers 200 with null for a token it does not know.
        return response.json() is not None

    def _access_token(self, key_hash: str, session: _Session) -> AccessToken:
        return AccessToken(
            token=key_hash,
            client_id=CLIENT_ID,
            scopes=[],
            expires_at=int(session.expires_at),
            resource=self._resource_url,
            subject=session.user_id,
            claims={
                "girder_token": session.girder_token,
                "login": session.login,
            },
        )
