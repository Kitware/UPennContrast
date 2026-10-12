# Access Control Patterns (Detailed)

## Access Levels

Girder uses numeric access levels on individual documents (not site-wide):

| Value | Constant | Meaning |
|-------|----------|---------|
| -1 | (none) | No access / Remove access |
| 0 | `AccessType.READ` | View-only access |
| 1 | `AccessType.WRITE` | Edit access |
| 2 | `AccessType.ADMIN` | Owner — can manage access (share, set public, delete) |

**Important:** `AccessType.ADMIN` means **owner of that specific document**, not a site-wide admin. The creator of a project/dataset gets ADMIN on it. This is distinct from `@access.admin` (the endpoint decorator), which requires the user to be a site-wide Girder admin.

Use `-1` (not `null`) to remove a user's access. This is Girder's convention and simplifies validation:

```python
# Good - use -1 to remove access
accessType = AccessType().validate(body["accessType"])  # Handles -1, 0, 1, 2

# Bad - don't use null/None for no access
if rawAccessType is None:
    accessType = None  # Unnecessary special case
```

## Setting User Access

```python
# Grant access
Model().setUserAccess(doc, targetUser, AccessType.WRITE, save=True)

# Remove access (use -1, not None)
Model().setUserAccess(doc, targetUser, -1, save=True)
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
@access.user(scope=TokenScope.DATA_WRITE)
@autoDescribeRoute(
    Description("Share dataset views with a user")
    .jsonParam("body", "Share request", paramType="body",
               schema={
                   "datasetViewIds": ["id1", "id2"],
                   "userMailOrUsername": "user@example.com",
                   "accessType": 0  # 0=READ, 1=WRITE, 2=ADMIN, -1=remove
               })
)
def share(self, body):
    # 1. Resolve user by email or username
    # 2. Load views and configurations at WRITE, the dataset at ADMIN
    # 3. Per document: level = grantableLevel(model, doc, caller, target, req)
    #    (helpers/aclLimits.py) and skip the document when it returns None
```

`AccessType().validate()` accepts 2, so a share endpoint that only checks
WRITE lets a collaborator grant **themselves** ADMIN (their own login as
the target). Any code that writes an ACL for someone else -- an endpoint,
or a propagation like project sharing -- must go through
`helpers/aclLimits.py`: the dataset needs ADMIN, a view/configuration
needs WRITE and is capped at the caller's level, and an entry above the
caller's level is left alone. Copying a whole ACL (a project's onto an
added dataset) is the same write: the caller's own ADMIN entry rides
along. Pass the acting user down to the model rather than letting the
model write unconditionally.

Check every path that hands data *out* on a container's authority, not
only the ones that write ACLs: a Zenodo upload of a project exported every
dataset in it on project ADMIN alone, including datasets the caller could
not read. Publishing or exporting a container needs ADMIN on each thing in
it (`requireProjectContentsAccess`) -- including what the export finds
indirectly: the Zenodo job publishes the property definitions of every
configuration a project dataset's views use, listed in the project or not.
Derive the checked set from what the export reads, not from the
container's own list.

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
