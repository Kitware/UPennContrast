<template>
  <div class="server-status">
    <v-tooltip left>
      <template #activator="{ on }">
        <div v-on="on">
          <v-icon class="save" v-if="saving">mdi-content-save</v-icon>
          <v-progress-circular v-else-if="loading" indeterminate />
          <v-icon v-else-if="lastError" color="error">
            mdi-alert-circle
          </v-icon>
          <v-icon class="sync" v-else>mdi-content-save</v-icon>
        </div>
      </template>
      <span v-if="saving">Saving...</span>
      <span v-else-if="loading"> Loading...</span>
      <span v-else-if="lastError">{{ lastError }}</span>
      <span v-else>In sync with the server</span>
    </v-tooltip>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "../store";

@Component
export default class ServerStatus extends Vue {
  readonly store = store;

  get lastError() {
    if (!store.lastError) {
      return "";
    }

    return store.lastError.message;
  }

  get loading() {
    return store.loading;
  }

  get saving() {
    return store.saving;
  }
}
</script>

<style lang="scss" scoped>
.server-status {
  margin-left: 1em;

  span {
    text-decoration: none;
  }

  &.dark {
    color: white;
  }
}

@keyframes save_animation {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.15);
  }
  50% {
    transform: scale(1);
  }
  75% {
    transform: scale(0.85);
  }
  100% {
    transform: scale(1);
  }
}

.save {
  transition: opacity 0.5s ease;
  opacity: 1;
  animation-name: save_animation;
  animation-duration: 2s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}

.sync {
  transition: opacity 0.5s ease;
  opacity: 0.2;
}
</style>
