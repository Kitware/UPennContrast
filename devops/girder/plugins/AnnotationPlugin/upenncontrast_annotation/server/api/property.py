from girder.api import access
from girder.api.describe import Description, autoDescribeRoute, describeRoute
from girder.constants import AccessType, TokenScope
from girder.api.rest import Resource, filtermodel, loadmodel
from girder.models.folder import Folder
from ..helpers import validation
from ..helpers.validation import (
    requireCountWithin,
    requireList,
    requireObjectBody,
    requireObjectId,
)
from ..models.property import AnnotationProperty as PropertyModel
from ..models.collection import Collection as CollectionModel
from girder.exceptions import RestException, AccessException
from bson import ObjectId
from bson.errors import InvalidId


MAX_COMPUTE_PROPERTIES = 100


class AnnotationProperty(Resource):

    def __init__(self):
        super().__init__()
        self.resourceName = "annotation_property"
        self._propertyModel = PropertyModel()

        self.route("DELETE", (":id",), self.delete)
        self.route("GET", (":id",), self.get)
        self.route("GET", (), self.getAllProperties)
        self.route("GET", ("count",), self.count)
        self.route("POST", (), self.create)
        self.route("POST", ("batch",), self.getBatch)
        self.route("POST", ("compute",), self.computeMultiple)
        self.route("PUT", (":id",), self.update)
        self.route(
            "POST",
            (
                ":id",
                "compute",
            ),
            self.compute,
        )

    @access.user(scope=TokenScope.DATA_WRITE)
    @describeRoute(
        Description(
            (
                "Compute a property for all annotations in the specified"
                "dataset, or a specific list of annotations"
            )
        )
        .param("id", "The id of the property", paramType="path")
        .param(
            "datasetId",
            (
                "The dataset for whose annotations "
                "the property should be computed"
            ),
            required=True,
        )
        .param(
            "body",
            "A JSON object containing parameters for the computation",
            paramType="body",
        )
    )
    def compute(self, id, params):
        propertyId = requireObjectId(id, "id")
        parameters = requireObjectBody(self.getBodyJson(), "Parameters")
        datasetId = requireObjectId(params.get("datasetId"), "datasetId")
        return self._computeProperties(
            datasetId, [propertyId], {str(propertyId): parameters}
        )[0]["jobs"]

    @access.user(scope=TokenScope.DATA_WRITE)
    @describeRoute(
        Description("Compute multiple properties for one dataset")
        .param(
            "body",
            "Dataset id and property computation requests",
            paramType="body",
        )
    )
    def computeMultiple(self, params):
        body = requireObjectBody(self.getBodyJson())
        datasetId = requireObjectId(body.get("datasetId"), "datasetId")
        requests = requireList(body.get("properties", []), "properties")
        requireCountWithin(
            len(requests), MAX_COMPUTE_PROPERTIES, "properties"
        )

        propertyIds = []
        parametersById = {}
        for request in requests:
            request = requireObjectBody(request, "each property request")
            propertyId = requireObjectId(request.get("id"), "property id")
            propertyKey = str(propertyId)
            if propertyKey in parametersById:
                raise RestException(
                    "property ids must be unique", code=400
                )
            propertyIds.append(propertyId)
            parametersById[propertyKey] = requireObjectBody(
                request.get("parameters"), "property parameters"
            )

        return self._computeProperties(
            datasetId, propertyIds, parametersById
        )

    def _computeProperties(self, datasetId, propertyIds, parametersById):
        """Schedule one compute job per property, in request order, after
        checking dataset WRITE, property access and every property's
        definition -- so an invalid later property cannot leave an earlier
        subset scheduled. Shared by the single and batch endpoints."""
        currentUser = self.getCurrentUser()
        Folder().load(
            datasetId,
            user=currentUser,
            level=AccessType.WRITE,
            exc=True,
        )
        properties = self._loadComputableProperties(propertyIds, currentUser)
        try:
            for annotationProperty in properties:
                self._propertyModel.validateCompute(annotationProperty)
        except ValueError as error:
            raise RestException(str(error), code=400) from error

        return [
            {
                "propertyId": str(annotationProperty["_id"]),
                "jobs": self._propertyModel.compute(
                    annotationProperty,
                    str(datasetId),
                    parametersById[str(annotationProperty["_id"])],
                ),
            }
            for annotationProperty in properties
        ]

    def _loadComputableProperties(self, propertyIds, user):
        """The properties with these ids, in request order. A property is
        computable by a caller who can read it through its own ACL (only
        its creator is ever on it) or through a configuration that
        references it -- the rule `get` applies, so a collaborator on a
        shared dataset can compute the properties they can see."""
        propertiesById = {
            annotationProperty["_id"]: annotationProperty
            for annotationProperty in self._propertyModel.find(
                {"_id": {"$in": propertyIds}}
            )
        }
        missing = [
            str(propertyId)
            for propertyId in propertyIds
            if propertyId not in propertiesById
        ]
        if missing:
            raise RestException(
                "No such property: %s" % ", ".join(missing), code=404
            )

        unreadable = {
            str(propertyId)
            for propertyId, annotationProperty in propertiesById.items()
            if not self._propertyModel.hasAccess(
                annotationProperty, user=user, level=AccessType.READ
            )
        }
        if unreadable:
            # One query for every property still unaccounted for.
            for config in CollectionModel().findWithPermissions(
                {"meta.propertyIds": {"$in": sorted(unreadable)}},
                user=user,
                level=AccessType.READ,
                fields=["meta.propertyIds"],
            ):
                unreadable.difference_update(config["meta"]["propertyIds"])
        if unreadable:
            raise AccessException(
                "Read access denied for property %s"
                % ", ".join(sorted(unreadable))
            )
        return [propertiesById[propertyId] for propertyId in propertyIds]

    def _propertyBody(self):
        """The request body reduced to the client-owned fields. Anything
        else -- `access`, `public`, or the `_id`/`_modelType` an exported
        property carries -- is dropped, so a caller cannot set the ACL of
        the property they create or update."""
        return self._propertyModel.filterUpdateFields(
            requireObjectBody(self.getBodyJson()))

    @access.user(scope=TokenScope.DATA_WRITE)
    @filtermodel(model=PropertyModel)
    @describeRoute(
        Description("Create a new property").param(
            "body", "Property Object", paramType="body"
        )
    )
    def create(self, params):
        currentUser = self.getCurrentUser()
        if not currentUser:
            raise AccessException("User not found", "currentUser")
        return self._propertyModel.create(currentUser, self._propertyBody())

    @describeRoute(
        Description("Delete an existing property")
        .param("id", "The property's Id", paramType="path")
        .errorResponse("ID was invalid.")
        .errorResponse("Write access was denied for the property.", 403)
    )
    @access.user(scope=TokenScope.DATA_WRITE)
    @loadmodel(
        model="annotation_property",
        plugin="upenncontrast_annotation",
        level=AccessType.WRITE,
    )
    def delete(self, annotation_property, params):
        self._propertyModel.delete(annotation_property)

    @describeRoute(
        Description("Update an existing property")
        .param("id", "The ID of the property.", paramType="path")
        .param(
            "body",
            "A JSON object containing the property.",
            paramType="body"
        )
        .errorResponse("Write access was denied for the item.", 403)
        .errorResponse("Invalid JSON passed in request body.")
        .errorResponse("Validation Error: JSON doesn't follow schema.")
    )
    @access.user(scope=TokenScope.DATA_WRITE)
    @loadmodel(
        model="annotation_property",
        plugin="upenncontrast_annotation",
        level=AccessType.WRITE,
    )
    def update(self, annotation_property, params):
        annotation_property.update(self._propertyBody())
        self._propertyModel.save(annotation_property)

    @access.public(scope=TokenScope.DATA_READ)
    @filtermodel(model=PropertyModel)
    @describeRoute(
        Description("Search for properties")
        .responseClass("property")
        .pagingParams(defaultSort="_id")
        .errorResponse()
    )
    def getAllProperties(self, params):
        # Note that this function is analogous to the "find" function in other
        # classes, but here we don't have any filtering criteria, so we can
        # just get all properties.

        limit, offset, sort = self.getPagingParameters(params, "lowerName")
        user = self.getCurrentUser()

        # Get all accessible configurations
        accessible_configs = list(CollectionModel().findWithPermissions(
            {},
            user=user,
            level=AccessType.READ
        ))

        # Collect all property IDs from accessible configurations
        # Note: propertyIds are stored as strings in meta.propertyIds (per
        # schema), but we need ObjectIds to query the _id field, so conversion
        # is necessary.
        accessible_property_ids = set()
        for config in accessible_configs:
            if 'meta' in config and 'propertyIds' in config['meta']:
                for pid in config['meta']['propertyIds']:
                    accessible_property_ids.add(ObjectId(pid))

        # Query properties
        # Note: $in with an empty list returns no results, same as empty set
        query = {'_id': {'$in': list(accessible_property_ids)}}

        return self._propertyModel.find(
            query,
            sort=sort,
            limit=limit,
            offset=offset,
        )

    @access.public(scope=TokenScope.DATA_READ)
    @describeRoute(
        Description("Get property count for a configuration")
        .param(
            "configurationId",
            "Get count for this configuration",
            required=True
        )
        .errorResponse()
    )
    def count(self, params):
        if "configurationId" not in params:
            raise RestException(
                code=400, message="Configuration ID is required"
            )

        configId = params["configurationId"]
        user = self.getCurrentUser()

        config = CollectionModel().load(
            configId, user=user, level=AccessType.READ, exc=True
        )

        # Count properties in this configuration
        count = 0
        if 'meta' in config and 'propertyIds' in config['meta']:
            count = len(config['meta']['propertyIds'])

        return {"count": count}

    @access.public(scope=TokenScope.DATA_READ)
    @filtermodel(model=PropertyModel)
    @autoDescribeRoute(
        Description("Get several properties by id (READ OPERATION via POST)")
        .notes(
            "POST avoids URL length limits. Returns the readable properties "
            "in request order; ids that do not exist or that no "
            "configuration readable by the caller references are omitted."
        )
        .jsonParam(
            "body", 'Object with "ids": a list of property ids.',
            paramType="body", requireObject=True,
        )
    )
    def getBatch(self, body):
        propertyIds = requireList(body.get("ids"), "ids")
        validation.requireCountWithin(
            len(propertyIds), validation.MAX_PROPERTY_IDS, "ids"
        )
        objectIds = [requireObjectId(pid, "ids") for pid in propertyIds]
        idStrings = [str(oid) for oid in objectIds]

        # As in get: a property is readable through any readable
        # configuration that references it (meta.propertyIds holds strings).
        # Only meta.propertyIds is needed: configurations carry layers,
        # tools and snapshots, and many can list the same property. The
        # permission check is part of the query, unaffected by the
        # projection.
        requested = set(idStrings)
        readable = {
            pid
            for config in CollectionModel().findWithPermissions(
                {"meta.propertyIds": {"$in": idStrings}},
                user=self.getCurrentUser(),
                level=AccessType.READ,
                fields=["meta.propertyIds"],
            )
            for pid in config["meta"]["propertyIds"]
            if pid in requested
        }
        props = {
            str(prop["_id"]): prop
            for prop in self._propertyModel.find({"_id": {"$in": [
                oid for oid in objectIds if str(oid) in readable
            ]}})
        }
        return [props[pid] for pid in idStrings if pid in props]

    @access.public(scope=TokenScope.DATA_READ)
    @filtermodel(model=PropertyModel)
    @describeRoute(
        Description("Get a property by its id.").param(
            "id", "The annotation property's id", paramType="path"
        )
    )
    def get(self, id, params):
        # Note that params is not used in this method, but it is required by
        # the describeRoute decorator. This is because the describeRoute
        # decorator expects a params argument, but we don't need it in this
        # method.

        user = self.getCurrentUser()

        # 1. Convert ID to ObjectId (will raise InvalidId if invalid)
        try:
            propertyId = ObjectId(id)
        except InvalidId as exc:
            raise RestException('Invalid Id', code=400) from exc

        # 2. Load property strictly to ensure it exists (force=True ignores
        # ACLs, exc=True raises exception if not found)
        prop = self._propertyModel.load(propertyId, force=True, exc=True)

        # 3. Check if user has READ access to ANY configuration that
        # references this property.
        # Note: CollectionSchema defines propertyIds as strings, so we pass
        # 'id' directly.
        accessible_configs = CollectionModel().findWithPermissions(
            {'meta.propertyIds': id},
            user=user,
            level=AccessType.READ,
            limit=1  # Optimization: We only need to know if ONE exists
        )

        # 4. If the cursor is empty, access is denied
        if accessible_configs.count() == 0:
            # If the user is anonymous and fails check, usually 401 is better,
            # but 403 or 404 is standard for "hidden" items.
            raise AccessException(f'Read access denied for property {id}')

        return prop
