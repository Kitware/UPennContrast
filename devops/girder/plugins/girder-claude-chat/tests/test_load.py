import pytest

from girder.plugin import loadedPlugins


@pytest.mark.plugin('claude_chat')
def test_import(server):
    assert 'claude_chat' in loadedPlugins()
