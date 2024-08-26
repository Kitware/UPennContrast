import os
from girder import plugin
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource
from girder.exceptions import ValidationException

from anthropic import Anthropic

class ClaudeChatResource(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = 'claude_chat'
        self.route('POST', (), self.chat)

    @access.user
    @autoDescribeRoute(
        Description('Send a message to Claude and get a response')
        .param('message', 'The message to send to Claude')
    )
    def chat(self, message):
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValidationException('Anthropic API key is not set in environment variables')

        client = Anthropic(api_key=api_key)

        try:
            with open("/src/girder-claude-chat/system_prompt_1.txt", "r") as f:
                system_prompt = f.read().strip()
            print("Successfully loaded system prompt")
        except IOError:
            print("Failed to load system prompt")
            system_prompt = ""
        
        try:
            response = client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                messages=[
                    {"role": "user", "content": message}
                ]
            )
            return {'response': response.content[0].text}
        except Exception as e:
            return {'error': str(e)}

class GirderPlugin(plugin.GirderPlugin):
    DISPLAY_NAME = 'Claude Chat'

    def load(self, info):
        info['apiRoot'].claude_chat = ClaudeChatResource()