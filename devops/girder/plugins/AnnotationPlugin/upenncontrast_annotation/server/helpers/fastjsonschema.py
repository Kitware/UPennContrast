from typing import Any
from bson.objectid import ObjectId
import fastjsonschema
from functools import partial, update_wrapper
from datetime import datetime


# ----------------------------------------------------------------
# Custom classes for "isinstance" redefinition per type
# ----------------------------------------------------------------


class ValidObjectIdMeta(type):
    def __instancecheck__(self, instance: Any) -> bool:
        return ObjectId.is_valid(instance)


class ValidObjectId(metaclass=ValidObjectIdMeta):
    pass


custom_type_classes = {
    "objectId": "ValidObjectId",
    "datetime": "datetime",
}
imported_classes = {
    "ValidObjectId": ValidObjectId,
    "datetime": datetime,
}


# ----------------------------------------------------------------
# Update types and create custom compile method
# ----------------------------------------------------------------


fastjsonschema.draft04.JSON_TYPE_TO_PYTHON_TYPE.update(custom_type_classes)
fastjsonschema.draft06.JSON_TYPE_TO_PYTHON_TYPE.update(custom_type_classes)


def customJsonSchemaCompile(
    definition, handlers={}, formats={}, use_default=True, use_formats=True
):
    """
    A compile fuction that adds support for custom types like 'objectId'
    To add a checkable type, simply update 'custom_type_classes' and
    'imported_classes' accordingly
    """
    resolver, code_generator = fastjsonschema._factory(
        definition, handlers, formats, use_default, use_formats
    )

    # --------------------------------
    # Added line
    code_generator._extra_imports_objects.update(imported_classes)
    # --------------------------------

    global_state = code_generator.global_state
    # Do not pass local state so it can recursively call itself.
    exec(code_generator.func_code, global_state)
    func = global_state[resolver.get_scope_name()]
    if formats:
        return update_wrapper(partial(func, custom_formats=formats), func)
    return func
