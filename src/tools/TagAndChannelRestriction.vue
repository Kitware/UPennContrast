<template>
  <v-container>
    <v-row>
      <v-col>
        <v-combobox
          v-model="newTags"
          :items="tagList"
          :search-input.sync="tagSearchInput"
          @change="changed"
          :label="tagsLabelWithDefault"
          multiple
          hide-selected
          small-chips
        >
          <template v-slot:selection="{ attrs, index, item, parent }">
            <v-chip
              :key="index"
              class="pa-2"
              v-bind="attrs"
              close
              small
              @click:close="parent.selectItem(item)"
            >
              {{ item }}
            </v-chip>
          </template>
        </v-combobox>
      </v-col>
      <v-col>
        <v-select
          v-model="selectedChannel"
          :items="channels"
          :label="channelLabelWithDefault"
          @change="changed"
        >
        </v-select>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {}
})
export default class TagAndChannelRestriction extends Vue {
  readonly store = store;

  get dataset() {
    return this.store.dataset;
  }

  // TODO: add "ALL", -1 ?
  get channels() {
    return (
      this.dataset?.channels.map(channelId => ({
        value: channelId,
        text: this.dataset?.channelNames.get(channelId)
      })) || []
    );
  }

  tagList = []; // TODO: keep a list of existing tags from existing annotations
  // channels = ["ch1", "brightField", "uiaeuaie"];

  tagSearchInput: string = "";
  newTags: string[] = [];
  selectedChannel: string = "";

  @Prop()
  readonly template!: any;

  @Prop()
  readonly tagsLabel!: string;

  @Prop()
  readonly channelsLabel!: string;

  get tagsLabelWithDefault() {
    return this.tagsLabel || "Restrict to Tags";
  }

  get channelLabelWithDefault() {
    return this.channelsLabel || "Restrict to channel";
  }

  changed() {
    this.tagSearchInput = "";
    this.$emit("input", { tags: this.newTags, channel: this.selectedChannel });
    this.$emit("change");
  }
}
</script>
