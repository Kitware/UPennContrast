<template>
  <v-card class="chat-component">
    <v-card-title>
      Nimbus chat
      <v-spacer></v-spacer>
      <v-btn icon @click="refreshChat">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
      <v-btn icon @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>
    <v-card-text>
      <div ref="chatMessages" class="chat-messages">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="message.type"
        >
          <template
            v-if="
              message.type === 'user' &&
              message.images &&
              message.images.length > 0
            "
          >
            <div class="image-grid">
              <img
                v-for="(image, imgIndex) in message.images"
                :key="imgIndex"
                :src="image.data"
                alt="User uploaded image"
                class="message-image"
              />
            </div>
          </template>
          <div
            v-if="message.type === 'assistant'"
            v-html="message.content"
          ></div>
          <div v-else>{{ message.content }}</div>
        </div>
      </div>
      <div v-if="currentImages.length > 0" class="current-images">
        <div
          v-for="(image, index) in currentImages"
          :key="index"
          class="current-image-container"
        >
          <img :src="image.data" alt="Current image" class="current-image" />
          <v-btn icon small class="remove-image" @click="removeImage(index)">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
      </div>
    </v-card-text>
    <v-card-actions>
      <template v-if="isWaiting">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </template>
      <template v-else>
        <v-text-field
          v-model="userInput"
          label="Type a message"
          @keyup.enter="sendMessage"
          @paste="handlePaste"
        ></v-text-field>
        <v-btn @click="sendMessage">Send</v-btn>
        <v-btn icon @click="$refs.fileInput.click()">
          <v-icon>mdi-image</v-icon>
        </v-btn>
        <input
          ref="fileInput"
          type="file"
          @change="handleFileUpload"
          accept="image/*"
          multiple
          style="display: none"
        />
      </template>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import { logError } from "@/utils/log";
import store from "@/store";
import chatStore from "@/store/chat";
import { IChatMessage, IChatImage, IFullChatMessage } from "@/store/model";

@Component
export default class ChatComponent extends Vue {
  userInput = "";
  isWaiting = false; // Add this data property

  get messages() {
    return chatStore.messages;
  }

  get currentImages() {
    return chatStore.currentImages;
  }

  async mounted() {
    await chatStore.initDB();
  }

  getMimeType(base64String: string): string {
    const mime = base64String.match(
      /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/,
    );
    return mime && mime.length ? mime[1] : "image/jpeg";
  }

  formatMessagesForAPI(): IFullChatMessage[] {
    return this.messages
      .map((message: IChatMessage): IFullChatMessage | null => {
        if (message.type === "user") {
          const content: IFullChatMessage["content"] = [
            { type: "text", text: message.content },
          ];
          if (message.images && message.images.length > 0) {
            message.images.forEach((image: IChatImage) => {
              const mimeType = this.getMimeType(image.data);
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: image.data.split(",")[1],
                },
              });
            });
          }
          return { role: "user", content };
        } else if (message.type === "assistant") {
          return {
            role: "assistant",
            content: [{ type: "text", text: message.content }],
          };
        } else if (message.type === "system" || message.type === "error") {
          return {
            role: "system",
            content: [{ type: "text", text: message.content }],
          };
        }
        return null;
      })
      .filter((message): message is IFullChatMessage => message !== null);
  }

  async sendMessage() {
    if (this.userInput.trim() === "" && this.currentImages.length === 0) return;

    this.isWaiting = true; // Set isWaiting to true when sending a message

    const messageContent = this.userInput.trim();
    const userMessage: IChatMessage = {
      type: "user",
      content: messageContent,
      images: [...this.currentImages],
    };
    await chatStore.addMessage(userMessage);

    this.userInput = "";
    chatStore.clearCurrentImages();

    try {
      const formattedMessages = this.formatMessagesForAPI();

      const botResponse =
        await store.chatAPI.sendFullChatMessage(formattedMessages);

      if (botResponse !== null) {
        await chatStore.addMessage(botResponse);
      } else {
        logError("Received null response from API");
      }
    } catch (error: any) {
      logError("Error sending message:", error);
      const errorMessage: IChatMessage = {
        type: "error",
        content: `Error sending message: ${error.message}. Please check console for details.`,
      };
      await chatStore.addMessage(errorMessage);
    }

    this.isWaiting = false; // Set isWaiting to false after receiving a response

    Vue.nextTick(() => {
      this.scrollToBottom();
    });
  }

  async handleFileUpload(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    for (let i = 0; i < files.length && this.currentImages.length < 4; i++) {
      try {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          chatStore.addCurrentImage({ data: result, type: file.type });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        logError("Error processing file:", error);
      }
    }
  }

  async handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length && this.currentImages.length < 4; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const result = e.target?.result as string;
            await chatStore.addCurrentImage({ data: result, type: blob.type });
          };
          reader.readAsDataURL(blob);
        }
      } else if (items[i].type === "text/plain") {
        items[i].getAsString((text) => {
          this.userInput += text;
        });
      }
    }
  }

  removeImage(index: number) {
    chatStore.removeCurrentImage(index);
  }

  $refs!: {
    chatMessages: HTMLElement;
    fileInput: HTMLInputElement;
  };

  scrollToBottom() {
    const chatMessages = this.$refs.chatMessages as HTMLElement;
    // console.log("scrollToBottom", chatMessages); // Appears to pick up the right element, not sure why it doesn't scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async refreshChat() {
    await chatStore.clearAll();
    this.userInput = "";
  }

  // formatMarkdown(content: string): string {
  //   return marked.parse(content);
  // }
}
</script>

<style scoped>
.chat-component {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 600px;
  height: 600px;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.202) !important;
  display: flex;
  flex-direction: column;
}

.v-card__text {
  flex-grow: 1;
  overflow-y: auto;
}

.chat-messages {
  display: flex;
  flex-direction: column;
}

.user {
  text-align: right;
  color: #2196f3;
  margin: 5px 0;
}

.bot {
  text-align: left;
  color: #4caf50;
  margin: 5px 0;
}

.system,
.error {
  text-align: center;
  color: gray;
  margin: 5px 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 5px;
  margin-bottom: 5px;
}

.message-image {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
}

.current-images {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 5px;
}

.current-image-container {
  position: relative;
}

.current-image {
  max-width: 80px;
  max-height: 80px;
  object-fit: contain;
}

.remove-image {
  position: absolute;
  top: 0;
  right: 0;
  background: rgba(255, 0, 0, 0.7) !important;
  color: white !important;
}

.refresh-button {
  margin-top: 10px;
}

/* Add these new styles for Markdown formatting */
.bot :deep(p) {
  margin-bottom: 10px;
}

.bot :deep(ul),
.bot :deep(ol) {
  padding-left: 20px;
  margin-bottom: 10px;
}

.bot :deep(h1),
.bot :deep(h2),
.bot :deep(h3),
.bot :deep(h4),
.bot :deep(h5),
.bot :deep(h6) {
  margin-top: 15px;
  margin-bottom: 10px;
}

.bot :deep(code) {
  background-color: #f0f0f0;
  padding: 2px 4px;
  border-radius: 4px;
}

.bot :deep(pre) {
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}

.bot :deep(blockquote) {
  border-left: 4px solid #ccc;
  padding-left: 10px;
  margin-left: 0;
  color: #666;
}
</style>
