# Access Control Patterns (Detailed)

## Access Levels

Girder uses numeric access levels on individual documents (not site-wide):

| Value | Constant | Meaning |
|-------|----------|---------|
| -1 | `AccessType.NONE` | Wire value for "remove" in share requests; map to `None` before `setUserAccess` |
| 0 | `AccessType.READ` | View-only access |
| 1 | `AccessType.WRITE` | Edit access |
| 2 | `AccessType.ADMIN` | Owner — can manage access (share, set public, delete) |

**Important:** `AccessType.ADMIN` means **owner of that specific document**, not a site-wide admin. The creator of a project/dataset gets ADMIN on it. This is distinct from `@access.admin` (the endpoint decorator), which requires the user to be a site-wide Girder admin.

`-1` is the **wire value** the share endpoints accept for "remove access". It is **not** a level to hand to Girder. `setUserAccess` removes the entry only when `level is None` (from Girder's `_setAccess`: `if level is not None: ... $set/$push entry` / `else: $pull`). Anything else, `-1` included, is stored as `{id, level: -1}`. That entry grants nothing, because `_hasUserAccess` requires `level >= requested`. It also isn't a deny rule: group and public access still apply. Its only effect is that the user reappears in the sharing table with no level. (Commit `7e763d9c1` switched the wire value from `null` to `-1` and dropped the `None` mapping, which caused exactly that.)

```python
# Good - validate the wire value, map -1 to None at the API boundary
from ..helpers.access_helpers import parseShareAccessType
level = parseShareAccessType(body["accessType"])  # -1 -> None; 0/1/2 kept
Model().setUserAccess(doc, targetUser, level, save=True)

# Bad - stores a level -1 entry instead of removing the user
Model().setUserAccess(doc, targetUser, AccessType().validate(-1), save=True)
```

`parseShareAccessType` also restricts the level to -1/0/1/2 with a 400. `AccessType().validate` alone accepts `SITE_ADMIN` (100) and raises `ValueError`, which surfaces as a 500. A share endpoint must also require **ADMIN** on the resource whose ACL it edits. With WRITE alone, a collaborator can grant themselves ADMIN or remove the owner (the dataset share endpoint allowed this until 2026-10-11). If the request lists several documents, check that they all belong to the resource you ADMIN-checked.

Bulk `$pull`/`$push` helpers (`ProjectModel._bulkSetUserAccess`) must likewise push only `level >= AccessType.READ`. Code that copies one ACL onto another (`_bulkSetAllUsersAccess`) must skip negative entries so leftover ones don't spread. `formatAccessList` hides negative entries left over from before the fix.

**Testing removal:** assert `user['_id'] not in {u['id'] for u in doc['access']['users']}` after reloading the document with `force=True`. "User can no longer read" passes with the `-1` bug present. So does checking the GET access list, because `formatAccessList` filters negatives.

## Setting User Access

```python
# Grant access
Model().setUserAccess(doc, targetUser, AccessType.WRITE, save=True)

# Remove access (None, never -1)
Model().setUserAccess(doc, targetUser, None, save=True)
```

## Setting Public Access

```python
Model().setPublic(doc, public=True, save=True)
```

## Getting Access Lists

```python
# Get full access list with user details populated
accessList = Model().getFullAccessList(doc)
# Returns: {'users': [...], 'groups': [...]}
```

## Sharing Pattern (Multi-Resource Permissions)

When sharing a dataset, permissions must be set on multiple resources simultaneously:

```
Dataset Folder ──> DatasetView ──> Configuration
   All three receive the same permissions
```

Resources affected by sharing:
1. **Dataset Folder** - The main folder containing the dataset
2. **DatasetViews** - User-specific view configurations
3. **Configurations (Collections)** - Tool definitions, layer settings, scales

### Share Endpoint Pattern

```python
@access.user
@autoDescribeRoute(
    Description("Share dataset views with a user")
    .jsonParam("body", "Share request", paramType="body",
               schema={
                   "datasetViewIds": ["id1", "id2"],
                   "userMailOrUsername": "user@example.com",
                   "accessType": 0  # 0=READ, 1=WRITE, -1=remove (-> None)
               })
)
def share(self, body):
    # 1. Resolve user by email or username
    # 2. For each DatasetView:
    #    - Set access on the DatasetView
    #    - Set access on the parent Dataset folder
    #    - Set access on associated Configurations
```

### Public Access Pattern

Making resources public/private affects the entire chain:

```python
@access.user
@autoDescribeRoute(
    Description("Set dataset public/private")
    .modelParam('datasetId', 'The dataset folder ID', model=Folder,
                level=AccessType.ADMIN, destName='dataset')
    .param('public', 'Whether to make public', dataType='boolean',
           required=True)
)
def setDatasetPublic(self, dataset, public):
    # Set public on: dataset folder + all DatasetViews + all Configurations
    Folder().setPublic(dataset, public, save=True)
    for view in datasetViews:
        DatasetViewModel().setPublic(view, public, save=True)
    for config in configurations:
        Collection().setPublic(config, public, save=True)
```

### Access Check: Owner Protection

Document owners (users with `AccessType.ADMIN` on the document, typically the creator) cannot be removed from the access list:

```python
# Check before removing access
if targetUser['_id'] == doc.get('creatorId'):
    raise RestException("Cannot remove owner's access")
```

## Reference

For full sharing implementation details, read: `codebaseDocumentation/SHARING.md`
