import { RestClientInstance } from "@/girder";
import { IChatImage, IChatMessage } from "./model";

interface IClaudeAPIChatMessage {
  role: "user" | "assistant" | "system";
  content: {
    type: string;
    text?: string;
    source?: {
      type: string;
      media_type: string;
      data: string;
    };
  }[];
}

function toClaudeApiMessage(message: IChatMessage): IClaudeAPIChatMessage {
  switch (message.type) {
    case "user":
      const content: IClaudeAPIChatMessage["content"] = [
        { type: "text", text: message.content },
      ];
      if (message.images && message.images.length > 0) {
        message.images.forEach((image: IChatImage) => {
          const match = image.data.match(
            /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,(.*)/,
          );
          if (match?.length === 3) {
            const [, media_type, data] = match;
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type,
                data,
              },
            });
          }
        });
      }
      return { role: "user", content };
    case "assistant":
      return {
        role: "assistant",
        content: [{ type: "text", text: message.content }],
      };
    case "system":
    case "error":
      return {
        role: "system",
        content: [{ type: "text", text: message.content }],
      };
  }
}

function toChatMessage(item: any): IChatMessage | null {
  if (item?.response) {
    return {
      type: "assistant",
      content: item.response,
    };
  }
  return null;
}

export default class ChatAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  async getChatBotAnswerToConversation(
    messages: IChatMessage[],
  ): Promise<IChatMessage | null> {
    const response = await this.client.post("claude_chat", {
      messages: messages.map(toClaudeApiMessage),
    });
    const { data } = response;
    if (!data) {
      return null;
    }
    if ("error" in data) {
      throw data.error;
    }
    return toChatMessage(data);
  }
}
