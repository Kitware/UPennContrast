import pytest
from pytest_girder.assertions import assertStatusOk

@pytest.mark.plugin('claude_chat')
def testClaudeChat(server):
    resp = server.request(
        '/claude_chat', method='POST',
        params={'message': 'Hello, Claude!'}
    )
    assertStatusOk(resp)
    assert 'response' in resp.json
    assert resp.json['response'].startswith('Claude:')