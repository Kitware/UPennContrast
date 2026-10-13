import datetime

import pytest
from girder.models.setting import Setting
from girder.models.token import Token
from girder.models.user import User

from nimbus_mcp_oauth import oauth, settings
from nimbus_mcp_oauth.models import AuthorizationCode, AuthorizationRequest

from .conftest import (
    CLAUDE_CALLBACK, ISSUER, RESOURCE, approveFlow, authorizeParams,
    connect, exchange, introspect, location, pkcePair, query, refresh,
    startFlow)

pytestmark = pytest.mark.plugin('nimbus_mcp_oauth')


def _status(resp):
    return int(resp.output_status.split()[0])


# --- off by default --------------------------------------------------------

def testEverythingIs404WhileDisabled(server, user):
    assert Setting().get(settings.ENABLED) is False
    _, challenge = pkcePair()
    calls = [
        ('GET', '/mcp_oauth/authorize', authorizeParams(challenge), None),
        ('GET', '/mcp_oauth/request/abc', None, user),
        ('POST', '/mcp_oauth/request/abc/approve', None, user),
        ('POST', '/mcp_oauth/token', {'grant_type': 'refresh_token'}, None),
        ('POST', '/mcp_oauth/revoke', {'token': 'x'}, None),
        ('POST', '/mcp_oauth/introspect', {'token': 'x'}, None),
        ('GET', '/mcp_oauth/grant', None, user),
    ]
    for method, path, params, who in calls:
        resp = server.request(path, method=method, params=params, user=who)
        assert _status(resp) == 404, path
    resp = server.request('/oauth-authorization-server', prefix='/.well-known',
                          appPrefix='/.well-known', isJson=False)
    assert _status(resp) == 404


def testMetadataAtServerRoot(enabled):
    resp = enabled.request(
        '/oauth-authorization-server', prefix='/.well-known',
        appPrefix='/.well-known')
    assert _status(resp) == 200
    meta = resp.json
    assert meta['issuer'] == ISSUER
    assert meta['authorization_endpoint'] == \
        ISSUER + '/girder/api/v1/mcp_oauth/authorize'
    assert meta['token_endpoint'] == ISSUER + '/girder/api/v1/mcp_oauth/token'
    assert meta['code_challenge_methods_supported'] == ['S256']
    assert meta['token_endpoint_auth_methods_supported'] == ['none']
    assert meta['client_id_metadata_document_supported'] is True
    assert meta['authorization_response_iss_parameter_supported'] is True
    assert 'registration_endpoint' not in meta  # no dynamic registration


# --- authorize -------------------------------------------------------------

def testUnknownClientOrRedirectIsNeverRedirected(enabled):
    _, challenge = pkcePair()
    for overrides in (
            {'client_id': 'someone-else'},
            {'client_id': 'https://evil.example/client'},
            {'redirect_uri': 'https://evil.example/cb'},
            {'redirect_uri': CLAUDE_CALLBACK + '/extra'},
            {'redirect_uri': None}):
        resp = enabled.request('/mcp_oauth/authorize',
                               params=authorizeParams(challenge, **overrides))
        assert _status(resp) == 400, overrides
        assert 'Location' not in dict(resp.headers)


@pytest.mark.parametrize('overrides,error', [
    ({'code_challenge_method': 'plain'}, 'invalid_request'),
    ({'code_challenge_method': None}, 'invalid_request'),
    ({'code_challenge': None}, 'invalid_request'),
    ({'code_challenge': 'short'}, 'invalid_request'),
    ({'response_type': 'token'}, 'unsupported_response_type'),
    ({'resource': None}, 'invalid_target'),
    ({'resource': 'https://other.example/mcp'}, 'invalid_target'),
    ({'scope': 'nimbusimage admin'}, 'invalid_scope'),
])
def testBadRequestsRedirectBackWithError(enabled, overrides, error):
    _, challenge = pkcePair()
    resp = enabled.request(
        '/mcp_oauth/authorize', params=authorizeParams(challenge, **overrides),
        isJson=False)
    assert _status(resp) == 302
    target = location(resp)
    assert target.startswith(CLAUDE_CALLBACK + '?')
    params = query(target)
    assert params['error'] == error
    assert params['state'] == 'xyz'
    assert params['iss'] == ISSUER


def testResourceIsComparedInCanonicalForm(enabled):
    startFlow(enabled, resource='HTTPS://Nimbus.Example:443/mcp/')


def testLoopbackRedirectMatchesAnyPort(enabled):
    for uri in ('http://localhost:3118/callback',
                'http://127.0.0.1:50000/callback'):
        startFlow(enabled, redirect_uri=uri)
    _, challenge = pkcePair()
    for uri in ('http://localhost:3118/other',
                'https://localhost:3118/callback',
                'http://evil.example:3118/callback'):
        resp = enabled.request('/mcp_oauth/authorize',
                               params=authorizeParams(challenge,
                                                      redirect_uri=uri))
        assert _status(resp) == 400, uri


# --- consent ---------------------------------------------------------------

def testConsentNeedsLoginAndShowsClient(enabled, user):
    _, requestId, _ = startFlow(enabled)
    resp = enabled.request(f'/mcp_oauth/request/{requestId}')
    assert _status(resp) == 401
    resp = enabled.request(f'/mcp_oauth/request/{requestId}', user=user)
    assert resp.json['clientName'] == 'Claude'
    assert resp.json['redirectHost'] == 'claude.ai'
    assert resp.json['localRedirect'] is False
    resp = enabled.request(f'/mcp_oauth/request/{requestId}/approve',
                           method='POST')
    assert _status(resp) == 401


def testApproveReturnsCodeStateAndIss(enabled, user):
    _, requestId, _ = startFlow(enabled)
    resp = enabled.request(f'/mcp_oauth/request/{requestId}/approve',
                           method='POST', user=user)
    target = resp.json['redirect']
    assert target.startswith(CLAUDE_CALLBACK + '?')
    params = query(target)
    assert params['state'] == 'xyz' and params['iss'] == ISSUER
    assert len(params['code']) >= 40
    # Stored hashed only
    assert AuthorizationCode().findOne({'_id': params['code']}) is None


def testRequestCanBeApprovedOnlyOnce(enabled, user):
    _, requestId, _ = startFlow(enabled)
    path = f'/mcp_oauth/request/{requestId}/approve'
    assert _status(enabled.request(path, method='POST', user=user)) == 200
    assert _status(enabled.request(path, method='POST', user=user)) == 404
    deny = f'/mcp_oauth/request/{requestId}/deny'
    assert _status(enabled.request(deny, method='POST', user=user)) == 404


def testExpiredRequestIsRefused(enabled, user):
    _, requestId, _ = startFlow(enabled)
    AuthorizationRequest().update({'_id': requestId}, {'$set': {
        'expiresAt': oauth.now() - datetime.timedelta(seconds=1)}})
    resp = enabled.request(f'/mcp_oauth/request/{requestId}/approve',
                           method='POST', user=user)
    assert _status(resp) == 404


def testDenyRedirectsWithAccessDenied(enabled, user):
    _, requestId, _ = startFlow(enabled)
    resp = enabled.request(f'/mcp_oauth/request/{requestId}/deny',
                           method='POST', user=user)
    params = query(resp.json['redirect'])
    assert params['error'] == 'access_denied' and params['state'] == 'xyz'


# --- token: authorization code --------------------------------------------

def testCodeExchangeIssuesTokens(enabled, user):
    tokens = connect(enabled, user)
    assert tokens['token_type'] == 'Bearer'
    assert tokens['access_token'].startswith('nio_')
    assert tokens['refresh_token'].startswith('nir_')
    assert tokens['expires_in'] == 8 * 3600
    assert tokens['scope'] == 'nimbusimage'


def testTokenResponsesAreNotCached(enabled, user):
    verifier, code, params = approveFlow(enabled, user)
    resp = exchange(enabled, code, verifier, params)
    assert dict(resp.headers)['Cache-Control'] == 'no-store'


@pytest.mark.parametrize('overrides', [
    {'code_verifier': 'x' * 50},
    {'code_verifier': None},
    {'redirect_uri': 'http://localhost:9999/callback'},
    {'client_id': 'https://claude.ai/other'},
    {'code': 'not-a-code'},
])
def testCodeExchangeChecks(enabled, user, overrides):
    verifier, code, params = approveFlow(enabled, user)
    code = overrides.pop('code', code)
    resp = exchange(enabled, code, verifier, params, **overrides)
    assert _status(resp) == 400
    assert resp.json['error'] == 'invalid_grant'


def testResourceMismatchAtTokenIsInvalidTarget(enabled, user):
    verifier, code, params = approveFlow(enabled, user)
    resp = exchange(enabled, code, verifier, params,
                    resource='https://other.example/mcp')
    assert resp.json['error'] == 'invalid_target'


def testCodeWorksOnceAndReplayRevokesItsTokens(enabled, user):
    verifier, code, params = approveFlow(enabled, user)
    first = exchange(enabled, code, verifier, params).json
    assert introspect(enabled, first['access_token']).json['active']
    replay = exchange(enabled, code, verifier, params)
    assert replay.json['error'] == 'invalid_grant'
    assert introspect(enabled, first['access_token']).json == {
        'active': False}
    assert refresh(enabled, first['refresh_token']).json['error'] == \
        'invalid_grant'


def testExpiredCodeIsRefused(enabled, user):
    verifier, code, params = approveFlow(enabled, user)
    AuthorizationCode().update({}, {'$set': {
        'expiresAt': oauth.now() - datetime.timedelta(seconds=1)}})
    assert exchange(enabled, code, verifier, params).json['error'] == \
        'invalid_grant'


def testUnsupportedGrantType(enabled):
    resp = enabled.request('/mcp_oauth/token', method='POST',
                           params={'grant_type': 'client_credentials'})
    assert resp.json['error'] == 'unsupported_grant_type'


# --- token: refresh --------------------------------------------------------

def testRefreshRotates(enabled, user):
    first = connect(enabled, user)
    second = refresh(enabled, first['refresh_token']).json
    assert second['refresh_token'] != first['refresh_token']
    assert second['access_token'] != first['access_token']
    assert introspect(enabled, second['access_token']).json['active']
    third = refresh(enabled, second['refresh_token']).json
    assert third['access_token'].startswith('nio_')


def testRefreshReuseRevokesTheConnection(enabled, user):
    first = connect(enabled, user)
    second = refresh(enabled, first['refresh_token']).json
    reuse = refresh(enabled, first['refresh_token'])
    assert reuse.json['error'] == 'invalid_grant'
    # Everything issued on that connection is dead, including the newest.
    assert introspect(enabled, second['access_token']).json == {
        'active': False}
    assert refresh(enabled, second['refresh_token']).json['error'] == \
        'invalid_grant'


def testRefreshFromAnotherClientRevokes(enabled, user):
    first = connect(enabled, user)
    resp = refresh(enabled, first['refresh_token'],
                   clientId='https://claude.ai/other')
    assert resp.json['error'] == 'invalid_grant'
    assert introspect(enabled, first['access_token']).json == {
        'active': False}


def testDisabledUserCannotRefresh(enabled, user):
    first = connect(enabled, user)
    user['status'] = 'disabled'
    User().save(user)
    assert refresh(enabled, first['refresh_token']).json['error'] == \
        'invalid_grant'
    assert introspect(enabled, first['access_token']).json == {
        'active': False}


# --- introspection ---------------------------------------------------------

def testIntrospectionNeedsTheSecret(enabled, user):
    tokens = connect(enabled, user)
    assert _status(introspect(enabled, tokens['access_token'],
                              secret=None)) == 404
    assert _status(introspect(enabled, tokens['access_token'],
                              secret='w' * 40)) == 404


def testIntrospectionReturnsAWorkingGirderSession(enabled, user):
    tokens = connect(enabled, user)
    info = introspect(enabled, tokens['access_token']).json
    assert info['active'] is True
    assert info['sub'] == str(user['_id'])
    assert info['username'] == user['login']
    assert info['resource'] == RESOURCE
    assert info['client_id'] == 'nimbusimage-claude'
    me = enabled.request('/user/me', token=info['girder_token'])
    assert me.json['_id'] == str(user['_id'])
    session = Token().load(info['girder_token'], force=True, objectId=False)
    lifetime = session['expires'] - session['created']
    assert lifetime == datetime.timedelta(hours=8)


def testRefreshTokensAndJunkAreNotIntrospectable(enabled, user):
    tokens = connect(enabled, user)
    for value in (tokens['refresh_token'], 'nio_' + 'a' * 43, 'garbage', ''):
        assert introspect(enabled, value).json == {'active': False}


def testSecretsAreStoredHashed(enabled, user):
    tokens = connect(enabled, user)
    from nimbus_mcp_oauth.models import AccessToken, RefreshToken
    assert AccessToken().findOne({'_id': tokens['access_token']}) is None
    assert RefreshToken().findOne({'_id': tokens['refresh_token']}) is None


# --- revocation and connections ---------------------------------------------

def testRevokeEndsTheConnectionAndItsGirderSessions(enabled, user):
    tokens = connect(enabled, user)
    girderToken = introspect(enabled, tokens['access_token']).json[
        'girder_token']
    resp = enabled.request('/mcp_oauth/revoke', method='POST',
                           params={'token': tokens['refresh_token']})
    assert _status(resp) == 200
    assert introspect(enabled, tokens['access_token']).json == {
        'active': False}
    assert Token().load(girderToken, force=True, objectId=False) is None
    # Unknown tokens are not an error (RFC 7009)
    resp = enabled.request('/mcp_oauth/revoke', method='POST',
                           params={'token': 'nir_' + 'b' * 43})
    assert _status(resp) == 200


def testUsersSeeAndRevokeOnlyTheirOwnConnections(enabled, user, admin):
    mine = connect(enabled, user)
    theirs = connect(enabled, admin)
    listed = enabled.request('/mcp_oauth/grant', user=user).json
    assert [g['clientName'] for g in listed] == ['Claude']
    adminGrant = enabled.request('/mcp_oauth/grant', user=admin).json[0]
    resp = enabled.request(f"/mcp_oauth/grant/{adminGrant['id']}",
                           method='DELETE', user=user)
    assert _status(resp) == 404
    assert introspect(enabled, theirs['access_token']).json['active']
    resp = enabled.request(f"/mcp_oauth/grant/{listed[0]['id']}",
                           method='DELETE', user=user)
    assert _status(resp) == 200
    assert introspect(enabled, mine['access_token']).json == {
        'active': False}
    resp = enabled.request('/mcp_oauth/grant/not-an-id', method='DELETE',
                           user=user)
    assert _status(resp) == 404


def testAuthorizeIsRateLimited(enabled, monkeypatch):
    from nimbus_mcp_oauth import rest
    monkeypatch.setattr(rest, '_authorizeLimit',
                        rest.SlidingWindowRateLimiter(2, 60))
    _, challenge = pkcePair()
    statuses = [
        _status(enabled.request('/mcp_oauth/authorize',
                                params=authorizeParams(challenge),
                                isJson=False))
        for _ in range(3)]
    assert statuses == [302, 302, 429]
