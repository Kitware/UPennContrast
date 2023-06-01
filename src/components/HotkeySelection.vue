<template>
  <div>
    <div class="pa-2">
      {{ hotkey === null ? "No hotkey yet" : `Current hotkey: ${hotkey}` }}
    </div>
    <div>
      <v-btn class="mr-2" @click="editHotkey()" :disabled="isRecordingHotkey">
        <v-progress-circular size="20" indeterminate v-if="isRecordingHotkey" />
        {{ isRecordingHotkey ? "Recording..." : "Record hotkey" }}
      </v-btn>
      <v-btn class="mr-2" @click="hotkey = null">
        Clear hotkey
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import Mousetrap from "mousetrap";

@Component
export default class HotkeySelection extends Vue {
  @VModel({ type: String, default: null }) hotkey!: null | string;
  isRecordingHotkey = false;

  editHotkey() {
    // The extensions of Mousetrap are loaded in main.ts
    // but they don't update the types, hence the ts-ignore
    this.isRecordingHotkey = true;
    // @ts-ignore
    Mousetrap.record((sequence: string[]) => {
      this.hotkey = sequence.join(" ");
      this.isRecordingHotkey = false;
    });
  }
}
</script>
