<template>
  <v-container class="pa-0 ma-0">
    <v-row
      v-for="[id, item] in Object.entries(workerInterface)"
      :key="id"
      class="pa-0 ma-0"
    >
      <v-col class="pa-0 ma-0" cols="4">
        <v-subheader>
          {{ id }}
        </v-subheader>
      </v-col>
      <v-col class="pa-0 ma-0">
        <v-slider
          v-if="item.type === 'number'"
          :max="item.max"
          :min="item.min"
          v-model="values[id]"
          :step="((item.max || 0) - (item.min || 0)) / 100.0"
          class="align-center"
        >
          <template v-slot:append>
            <v-text-field
              v-model="values[id]"
              type="number"
              style="width: 60px"
              class="mt-0 pt-0"
            >
            </v-text-field>
          </template>
        </v-slider>
        <v-text-field
          v-if="item.type === 'text'"
          v-model="values[id]"
          dense
        ></v-text-field>
        <tag-picker
          v-if="item.type === 'tags'"
          v-model="values[id]"
        ></tag-picker>
        <layer-select
          v-if="item.type === 'layer'"
          v-model="values[id]"
        ></layer-select>
        <v-select
          v-if="item.type === 'select'"
          v-model="values[id]"
          :items="item.items"
        ></v-select>
        <channel-select
          v-if="item.type === 'channel'"
          v-model="values[id]"
        ></channel-select>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import {
  IWorkerInterface,
  IWorkerInterfaceValues,
  TWorkerInterfaceType,
  TWorkerInterfaceValue
} from "@/store/model";
import LayerSelect from "@/components/LayerSelect.vue";
import ChannelSelect from "@/components/ChannelSelect.vue";
import TagPicker from "@/components/TagPicker.vue";
// Popup for new tool configuration
@Component({ components: { LayerSelect, ChannelSelect, TagPicker } })
export default class WorkerInterfaceValues extends Vue {
  @Prop()
  readonly workerInterface!: IWorkerInterface;

  getDefault(
    type: TWorkerInterfaceType,
    defaultValue: TWorkerInterfaceValue = undefined
  ) {
    if (defaultValue) {
      return defaultValue;
    }
    switch (type) {
      case "number":
        return 0.0;

      case "text":
        return "";

      case "tags":
        return [];

      case "layer":
        return 0;

      case "select":
        return "";

      case "channel":
        return 0;
    }
  }

  get values() {
    const interfaceValues: IWorkerInterfaceValues = {};
    for (const id in this.workerInterface) {
      const interfaceTemplate = this.workerInterface[id];
      interfaceValues[id] = this.getDefault(
        interfaceTemplate.type,
        interfaceTemplate.default
      );
    }
    // emit a reactive object
    // only triggered when workerInterface changes
    this.$emit("input", interfaceValues);
    return interfaceValues;
  }
}
</script>
