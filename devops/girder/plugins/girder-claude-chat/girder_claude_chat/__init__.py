import os
import logging
from girder import plugin
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource
from girder.exceptions import ValidationException

from anthropic import Anthropic

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ClaudeChatResource(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = 'claude_chat'
        self.route('POST', (), self.single_message)
        self.route('POST', ('full_chat',), self.full_chat)

        # Load system prompt
        try:
            with open("/src/girder-claude-chat/system_prompt_1.txt", "r") as f:
                self.system_prompt = f.read().strip()
            logger.info("Successfully loaded system prompt")
        except IOError:
            logger.error("Failed to load system prompt")
            self.system_prompt = ""

    @access.user
    @autoDescribeRoute(
        Description('Send a single message to Claude and get a response')
        .param('message', 'The message to send to Claude')
    )
    def single_message(self, message):
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValidationException('Anthropic API key is not set in environment variables')

        client = Anthropic(api_key=api_key)
        
        try:
            response = client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                system=self.system_prompt,
                messages=[
                    {"role": "user", "content": message}
                ]
            )
            return {'response': response.content[0].text}
        except Exception as e:
            logger.error(f"Error in single message endpoint: {str(e)}", exc_info=True)
            return {'error': str(e)}

    @access.user
    @autoDescribeRoute(
        Description('Send a full chat structure to Claude and get a response')
        .jsonParam('data', 'The full chat structure', paramType='body', required=True)
    )
    def full_chat(self, data):
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValidationException('Anthropic API key is not set in environment variables')

        client = Anthropic(api_key=api_key)

        try:
            logger.debug(f"Received data: {data}")
            messages = data.get('messages', [])
            logger.debug(f"Processing {len(messages)} messages")

            response = client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                temperature=0,
                system=self.system_prompt,
                messages=messages
            )
            
            logger.debug(f"Received response from Anthropic API: {response.content[0].text[:100]}...")
            return {'response': response.content[0].text}
        except Exception as e:
            logger.error(f"Error in full chat endpoint: {str(e)}", exc_info=True)
            return {'error': str(e)}

class GirderPlugin(plugin.GirderPlugin):
    DISPLAY_NAME = 'Claude Chat'

    def load(self, info):
        info['apiRoot'].claude_chat = ClaudeChatResource()