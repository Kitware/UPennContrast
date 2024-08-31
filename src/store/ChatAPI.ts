import { RestClientInstance } from "@/girder";
import { IChatMessage, IChatImage } from "./model";

// import { logError } from "@/utils/log";
// import { fetchAllPages } from "@/utils/fetch";
// import { markRaw } from "vue";

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
      .post("claude_chat/full_chat", messages)
      .then((response) => this.toChatMessage(response));
  }

  toChatMessage(item: any): IChatMessage {
    console.log(item);
    return {
      type: "assistant",
      content: item.data.response,
    };
  }
}
