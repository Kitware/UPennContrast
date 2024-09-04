import os
import logging
from anthropic import Anthropic

from girder import plugin
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource
from girder.exceptions import ValidationException

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


class ClaudeChatResource(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = 'claude_chat'
        self.route('POST', (), self.query_claude)

        # Load system prompt
        try:
            with open("/src/girder-claude-chat/system_prompt_1.txt", "r") as f:
                self.system_prompt = f.read().strip()
            logger.info("Successfully loaded system prompt")
        except IOError:
            logger.error("Failed to load system prompt")
            self.system_prompt = ""

        # Create client
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValidationException(
                'Anthropic API key is not set in environment variables'
            )
        self.client = Anthropic(api_key=api_key)

    @access.user
    @autoDescribeRoute(
        Description('Send a full chat structure to Claude and get a response')
        .jsonParam('data', 'Chat structure', paramType='body', required=True)
    )
    def query_claude(self, data):
        messages = data.get('messages', [])
        logger.debug(f"Processing {len(messages)} messages")
        try:
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                temperature=0,
                system=self.system_prompt,
                messages=messages
            )
            return {'response': response.content[0].text}
        except Exception as e:
            logger.error(
                f"Error in full chat endpoint: {str(e)}", exc_info=True
            )
            return {'error': str(e)}


class GirderPlugin(plugin.GirderPlugin):
    DISPLAY_NAME = 'Claude Chat'

    def load(self, info):
        info['apiRoot'].claude_chat = ClaudeChatResource()
