import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule,
} from "vuex-module-decorators";
import store from "./root";

export interface Message {
  type: "user" | "bot";
  content: string;
  images?: Image[];
}

export interface Image {
  data: string;
  type: string;
}

@Module({ dynamic: true, store, name: "chat" })
export class Chat extends VuexModule {
  messages: Message[] = [];
  currentImages: Image[] = [];

  @Mutation
  ADD_MESSAGE(message: Message) {
    this.messages.push(message);
  }

  @Mutation
  SET_MESSAGES(messages: Message[]) {
    this.messages = messages;
  }

  @Action
  async initDB() {
    try {
      const db = await this.openDatabase();
      console.log("Chat database initialized successfully");
      // For now, we'll just log the success. Later, we'll load messages here.
    } catch (error) {
      console.error("Failed to initialize chat database:", error);
    }
  }

  @Action
  async addMessage(message: Message) {
    this.context.commit("ADD_MESSAGE", message);
    if (message.type === "user") {
      // Simulate bot response
      const botResponse: Message = {
        type: "bot",
        content: `Hello there, you said: "${message.content}"`,
      };
      setTimeout(() => {
        this.ADD_MESSAGE(botResponse);
      }, 500);
    }
    // Later, we'll add database saving here
  }

  @Action
  async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("ChatHistoryDB", 1);

      request.onerror = () => reject("Error opening database");

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore("messages", {
          keyPath: "id",
          autoIncrement: true,
        });
      };
    });
  }
}

export default getModule(Chat);
