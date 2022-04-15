<template>
  <v-container class="pa-0 ma-0">
    <v-col class="pa-0 ma-0">
      <v-row v-for="item in entries" :key="item.id" class="pa-0 ma-0">
        <v-col class="pa-0 ma-0">
          <v-subheader>
            {{ item.id }}
          </v-subheader>
        </v-col>
        <v-col class="pa-0 ma-0">
          <v-slider
            v-if="item.type === 'number'"
            :max="item.max"
            :min="item.min"
            v-model="item.value"
            :step="(item.max - item.min) / 100.0"
            dense
            thumb-label="always"
          ></v-slider>
          <v-text-field
            v-if="item.type === 'text'"
            v-model="item.value"
            dense
          ></v-text-field>
          <tag-picker
            v-if="item.type === 'tags'"
            v-model="item.value"
          ></tag-picker>
          <layer-select
            v-if="item.type === 'layer'"
            v-model="item.value"
          ></layer-select>
        </v-col>
      </v-row>
      <v-row>
        <v-btn v-if="canPreview" @click="preview">preview</v-btn>
        <v-spacer></v-spacer>
        <v-btn @click="compute">compute</v-btn>
      </v-row>
      <v-row v-if="canPreview">
        <v-checkbox
          v-model="displayWorkerPreview"
          label="Display Previews"
        ></v-checkbox>
      </v-row>
    </v-col>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, VModel } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import propertiesStore from "@/store/properties";
import { IWorkerInterface } from "@/store/model";
import LayerSelect from "@/components/LayerSelect.vue";
import DockerImageSelect from "@/components/DockerImageSelect.vue";
import TagPicker from "@/components/TagPicker.vue";
// Popup for new tool configuration
@Component({ components: { LayerSelect, TagPicker, DockerImageSelect } })
export default class WorkerInterface extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  @VModel({ type: Boolean }) show!: Boolean;

  @Prop()
  readonly workerInterface!: IWorkerInterface;

  @Prop()
  readonly canPreview!: boolean;

  getDefault(type: string, defaultValue: any = null) {
    if (defaultValue) {
      return defaultValue;
    }
    if (type === "number") {
      return 0.0;
    }
    if (type === "text") {
      return "";
    }
    if (type === "tags") {
      return [];
    }
    if (type === "layers") {
      return 0;
    }
  }
  get entries() {
    return Object.keys(this.workerInterface).map(key => ({
      ...this.workerInterface[key],
      id: key,
      value: this.getDefault(
        this.workerInterface[key].type,
        this.workerInterface[key].default
      )
    }));
  }

  get displayWorkerPreview() {
    return this.propertyStore.displayWorkerPreview;
  }

  set displayWorkerPreview(value: boolean) {
    this.propertyStore.setDisplayWorkerPreview(value);
  }

  getEntryResult() {
    return this.entries.reduce(
      (result, entry) => ({
        ...result,
        [entry.id]: { type: entry.type, value: entry.value }
      }),
      {}
    );
  }

  preview() {
    if (this.canPreview) {
      this.$emit("preview", this.getEntryResult());
    }
  }

  compute() {
    this.$emit("compute", this.getEntryResult());
  }
}
</script>
