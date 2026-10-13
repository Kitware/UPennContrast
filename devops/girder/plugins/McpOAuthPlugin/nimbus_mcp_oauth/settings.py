"""Settings for the MCP OAuth server, all under ``mcp_oauth.``.

Set them as a site admin with ``PUT /system/setting``. While ``enabled`` is
false every endpoint of this plugin answers 404.
"""
from girder.exceptions import ValidationException
from girder.models.setting import Setting
from girder.utility import setting_utilities

ENABLED = 'mcp_oauth.enabled'
# The public origin that issues tokens, e.g. https://app.nimbusimage.com.
# Must equal the MCP server's NI_MCP_ISSUER_URL exactly: clients compare it
# with the protected-resource metadata's authorization_servers entry.
ISSUER = 'mcp_oauth.issuer'
# Public URL of Girder's REST root as browsers and clients reach it, e.g.
# https://app.nimbusimage.com/girder/api/v1 (HAProxy adds /girder).
API_URL = 'mcp_oauth.api_url'
# Where the consent page lives, e.g. https://app.nimbusimage.com/
FRONTEND_URL = 'mcp_oauth.frontend_url'
# The MCP server URLs a token may be issued for (RFC 8707 resource).
RESOURCES = 'mcp_oauth.resources'
# Shared secret the MCP service sends to the introspection endpoint. Empty
# disables introspection.
INTROSPECTION_SECRET = 'mcp_oauth.introspection_secret'
# Hosts whose Client ID Metadata Documents are fetched.
CIMD_HOSTS = 'mcp_oauth.cimd_hosts'

DEFAULT_CIMD_HOSTS = ['claude.ai', 'claude.com']


@setting_utilities.default(ENABLED)
def _defaultEnabled():
    return False


@setting_utilities.validator(ENABLED)
def _validateEnabled(doc):
    if not isinstance(doc['value'], bool):
        raise ValidationException('Must be true or false.', 'value')


@setting_utilities.default({ISSUER, API_URL, FRONTEND_URL,
                            INTROSPECTION_SECRET})
def _defaultEmpty():
    return ''


@setting_utilities.validator({ISSUER, API_URL, FRONTEND_URL})
def _validateUrl(doc):
    value = doc['value']
    if not isinstance(value, str):
        raise ValidationException('Must be a URL.', 'value')
    if value and not value.startswith(('https://', 'http://')):
        raise ValidationException('Must be an http(s) URL.', 'value')
    doc['value'] = value.rstrip('/')


@setting_utilities.validator(INTROSPECTION_SECRET)
def _validateSecret(doc):
    value = doc['value']
    if not isinstance(value, str) or (value and len(value) < 32):
        raise ValidationException(
            'Must be empty or at least 32 characters.', 'value')


@setting_utilities.default(RESOURCES)
def _defaultResources():
    return []


@setting_utilities.validator(RESOURCES)
def _validateResources(doc):
    value = doc['value']
    if not isinstance(value, list) or not all(
            isinstance(v, str) and v.startswith(('https://', 'http://'))
            for v in value):
        raise ValidationException(
            'Must be a list of http(s) URLs.', 'value')


@setting_utilities.default(CIMD_HOSTS)
def _defaultCimdHosts():
    return list(DEFAULT_CIMD_HOSTS)


@setting_utilities.validator(CIMD_HOSTS)
def _validateCimdHosts(doc):
    value = doc['value']
    if not isinstance(value, list) or not all(
            isinstance(v, str) and v and '/' not in v for v in value):
        raise ValidationException('Must be a list of host names.', 'value')
    doc['value'] = [v.lower() for v in value]


def get(key):
    return Setting().get(key)


def enabled():
    return get(ENABLED) is True
