import { RestClientInstance } from "@/girder";
import { IChatMessage } from "./model";

export default class ChatAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  sendSingleChatMessage(message: IChatMessage): Promise<IChatMessage | null> {
    return this.client
      .post("claude_chat", undefined, { params: { message } })
      .then((response) => this.toChatMessage(response));
  }

  sendFullChatMessage(messages: IChatMessage[]): Promise<IChatMessage | null> {
    return this.client
      .post("claude_chat/full_chat", { messages })
      .then((response) => {
        if (response && response.data) {
          return this.toChatMessage(response);
        }
        return null;
      });
  }

  toChatMessage(item: any): IChatMessage | null {
    if (item && item.data && item.data.response) {
      return {
        type: "assistant",
        content: item.data.response,
      };
    }
    return null;
  }
}
