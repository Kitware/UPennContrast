<template>
  <v-card class="chat-component">
    <v-card-title>
      Nimbus chat
      <v-spacer></v-spacer>
      <v-btn icon @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>
    <v-card-text>
      <div v-if="messages && messages.length > 0" class="chat-messages">
        <div v-for="(message, index) in messages" :key="index" :class="message.type">
          {{ message.content }}
        </div>
      </div>
      <div v-else>No messages yet.</div>
    </v-card-text>
    <v-card-actions>
      <v-text-field
        v-model="userInput"
        label="Type a message"
        @keyup.enter="sendMessage"
      ></v-text-field>
      <v-btn @click="sendMessage">Send</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import chatStore from "@/store/chat";

@Component
export default class ChatComponent extends Vue {
  userInput = "";

  get messages() {
    return chatStore.messages;
  }

  sendMessage() {
    if (this.userInput.trim()) {
      chatStore.addMessage({ type: "user", content: this.userInput.trim() });
      this.userInput = "";
    }
  }
}
</script>

<style scoped>
.chat-component {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
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
  color: #2196F3;
  margin: 5px 0;
}

.bot {
  text-align: left;
  color: #4CAF50;
  margin: 5px 0;
}
</style>