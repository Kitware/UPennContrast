import {
  VuexModule,
  Module,
  Mutation,
  Action,
  getModule,
} from "vuex-module-decorators";
import store from "./root";

export interface Message {
  type: "user" | "bot" | "system" | "error";
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

  @Mutation
  ADD_CURRENT_IMAGE(image: Image) {
    this.currentImages.push(image);
  }

  @Mutation
  REMOVE_CURRENT_IMAGE(index: number) {
    this.currentImages.splice(index, 1);
  }

  @Mutation
  CLEAR_CURRENT_IMAGES() {
    this.currentImages = [];
  }

  @Mutation
  CLEAR_ALL() {
    this.messages = [];
    this.currentImages = [];
  }

  @Action
  async initDB() {
    try {
      const request = indexedDB.open("ChatHistoryDB", 1);

      request.onerror = () => {
        console.error("Error opening database");
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(["messages"], "readonly");
        const store = transaction.objectStore("messages");
        const getRequest = store.getAll();

        getRequest.onerror = () => {
          console.error("Error loading messages");
        };

        getRequest.onsuccess = () => {
          this.SET_MESSAGES(getRequest.result);
        };
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore("messages", {
          keyPath: "id",
          autoIncrement: true,
        });
      };
    } catch (error) {
      console.error("Failed to initialize chat database:", error);
    }
  }

  @Action
  async addMessage(message: Message) {
    this.ADD_MESSAGE(message);

    try {
      const request = indexedDB.open("ChatHistoryDB", 1);

      request.onerror = () => {
        console.error("Error opening database");
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(["messages"], "readwrite");
        const store = transaction.objectStore("messages");
        const addRequest = store.add(message);

        addRequest.onerror = () => {
          console.error("Error saving message");
        };

        addRequest.onsuccess = () => {
          console.log("Message saved successfully");
        };
      };
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  }

  @Action
  addCurrentImage(image: Image) {
    this.ADD_CURRENT_IMAGE(image);
  }

  @Action
  removeCurrentImage(index: number) {
    this.REMOVE_CURRENT_IMAGE(index);
  }

  @Action
  clearCurrentImages() {
    this.CLEAR_CURRENT_IMAGES();
  }

  @Action
  async clearAll() {
    this.CLEAR_ALL();

    try {
      const request = indexedDB.open("ChatHistoryDB", 1);

      request.onerror = () => {
        console.error("Error opening database");
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(["messages"], "readwrite");
        const store = transaction.objectStore("messages");
        const clearRequest = store.clear();

        clearRequest.onerror = () => {
          console.error("Error clearing database");
        };

        clearRequest.onsuccess = () => {
          console.log("Database cleared successfully");
        };
      };
    } catch (error) {
      console.error("Failed to clear database:", error);
    }
  }
}

export default getModule(Chat);
