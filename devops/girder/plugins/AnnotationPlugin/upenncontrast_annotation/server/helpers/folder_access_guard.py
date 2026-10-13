"""Preserve owner access on dataset folders.

Girder's core `Folder.setAccessList` (and the `PUT /folder/{id}/access`
endpoint that calls it) accept any access list, including one that
removes the caller. A non-admin folder owner can therefore lock
themselves out of their own dataset — see
`codebaseDocumentation/BUG_OWNER_CAN_REMOVE_SELF_FROM_DATASET.md`.

This module installs a `model.folder.save` listener that rejects any
save of a `contrastDataset` folder whose `access.users` does not include
the creator at ADMIN level. Site admins can bypass the check (recovery
path); ownership transfer is supported by updating `creatorId` in the
same save.
"""
from bson import ObjectId

from girder import events
from girder.api import rest
from girder.constants import AccessType
from girder.exceptions import ValidationException


CONTRAST_DATASET_SUBTYPE = "contrastDataset"
CREATOR_MUST_KEEP_ADMIN = (
    "Dataset creator must retain ADMIN access on the folder. "
    "If you want to transfer ownership, add the new owner first "
    "and then have them remove your access."
)
EVENT_LISTENER_NAME = "upenn.folder.preserve_creator_admin"


def _is_contrast_dataset(doc):
    meta = doc.get("meta") or {}
    return meta.get("subtype") == CONTRAST_DATASET_SUBTYPE


def _creator_has_admin(doc):
    creator_id = doc.get("creatorId")
    if creator_id is None:
        # No creator recorded — nothing to protect.
        return True
    creator_id = ObjectId(creator_id)
    access = doc.get("access") or {}
    for entry in access.get("users", []) or []:
        if (
            ObjectId(entry.get("id")) == creator_id
            and entry.get("level") == AccessType.ADMIN
        ):
            return True
    return False


def _caller_is_site_admin_or_internal():
    """Site admins can override (recovery path); outside a REST context
    (workers, scripts) there is no caller and internal code is not blocked.
    """
    try:
        current = rest.getCurrentUser()
    except Exception:
        current = None
    return current is None or bool(current.get("admin"))


def require_creator_keeps_admin(folder, target_user, level):
    """Refuse, before anything is written, a share that would take the
    dataset creator below ADMIN.

    The save listener below catches this too, but too late for the plugin's
    share paths: dataset_view/share writes the views and configurations
    before the folder (so a rejected folder save would leave them changed),
    and project propagation writes folders with bulk updates that fire no
    save event at all. Both call this first.

    :param folder: The dataset folder whose ACL is about to change.
    :param target_user: The user whose access is changing.
    :param level: The new level, or None to remove access.
    :raises ValidationException: If the creator would lose ADMIN.
    """
    if not _is_contrast_dataset(folder):
        return
    creator_id = folder.get("creatorId")
    if creator_id is None or ObjectId(creator_id) != target_user["_id"]:
        return
    if level is not None and level >= AccessType.ADMIN:
        return
    if _caller_is_site_admin_or_internal():
        return
    raise ValidationException(CREATOR_MUST_KEEP_ADMIN, field="access")


def _ensure_creator_admin_access(event):
    """model.folder.save listener that enforces creator-stays-ADMIN."""
    doc = event.info
    if not isinstance(doc, dict):
        return
    if "_id" not in doc:
        # New folder; Girder grants the creator ADMIN before the first
        # save when `Folder.createFolder` is used. Skip — we don't want
        # to fight folder creation paths that haven't applied access
        # yet.
        return
    if not _is_contrast_dataset(doc):
        return
    if _creator_has_admin(doc):
        return

    if _caller_is_site_admin_or_internal():
        return

    raise ValidationException(CREATOR_MUST_KEEP_ADMIN, field="access")


def register():
    """Idempotently install the folder-access guard event listener."""
    events.unbind("model.folder.save", EVENT_LISTENER_NAME)
    events.bind(
        "model.folder.save",
        EVENT_LISTENER_NAME,
        _ensure_creator_admin_access,
    )
