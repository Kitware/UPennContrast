<template>
  <!-- channel -->
  <v-select
    v-bind="$attrs"
    :items="channelItems"
    dense
    v-model="channel"
    :label="label"
  />
</template>

<script lang="ts">
import { Vue, Component, Prop, VModel } from "vue-property-decorator";
import store from "@/store";

// Interface element selecting a channel
@Component({})
export default class ChannelSelect extends Vue {
  readonly store = store;

  // Adds an "Any" selection choice
  @Prop({ default: false })
  readonly any!: boolean;

  @Prop({ default: "" })
  readonly label!: string;

  @VModel({ type: Number }) channel!: Number;

  get channelItems() {
    const res = [];
    if (this.any) {
      res.push({ text: "Any", value: null });
    }
    if (this.store.dataset) {
      for (const channel of this.store.dataset.channels) {
        res.push({
          text:
            this.store.dataset.channelNames.get(channel) ||
            `Channel ${channel}`,
          value: channel,
        });
      }
    }
    return res;
  }
}
</script>
