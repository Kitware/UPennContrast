"""Shared access level constants and helpers."""

ACCESS_MAP = {"read": 0, "write": 1, "admin": 2, "remove": -1}


def resolve_access(access: str) -> int:
    """Convert a human-readable access level to its integer code.

    Args:
        access: One of 'read', 'write', 'admin', 'remove'.

    Raises:
        ValueError: If the access level is not recognized.
    """
    if access not in ACCESS_MAP:
        raise ValueError(
            f"Invalid access level '{access}'. "
            f"Must be one of: {', '.join(ACCESS_MAP.keys())}"
        )
    return ACCESS_MAP[access]


def refuse_self_target(gc, user_email_or_name: str) -> None:
    """Raise if ``user_email_or_name`` names the calling user.

    The share endpoints set the target's entry on every resource they
    touch, so targeting yourself can only lower your own level — and
    "remove" locks you out of what you own.

    Raises:
        ValueError: If the target is the current user.
    """
    me = gc.get("user/me")
    # null when the token lacks USER_INFO_READ scope (e.g. a scoped API
    # key): we can't tell who the caller is, so leave it to the server.
    if me is not None and user_email_or_name.lower() in (
        me["login"].lower(), me["email"].lower()
    ):
        raise ValueError(
            "Refusing to change your own access; another owner or a "
            "site admin must do that."
        )
