<template>
  <v-container class="pa-0 ma-0">
    <!--
      Dummy item group to prevent "change" events to be registered by a parent item group
      See: https://github.com/Kitware/UPennContrast/pull/391#issuecomment-1557606390
    -->
    <v-list-item-group>
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
            v-model="interfaceValues[id]"
            :max="item.max"
            :min="item.min"
            :step="((item.max || 0) - (item.min || 0)) / 100.0"
            class="align-center"
          >
            <template v-slot:append>
              <v-text-field
                v-model="interfaceValues[id]"
                type="number"
                :max="item.max"
                :min="item.min"
                :step="((item.max || 0) - (item.min || 0)) / 100.0"
                style="width: 60px"
                class="mt-0 pt-0"
              >
              </v-text-field>
            </template>
          </v-slider>
          <v-text-field
            v-if="item.type === 'text'"
            v-model="interfaceValues[id]"
            dense
          ></v-text-field>
          <tag-picker
            v-if="item.type === 'tags'"
            v-model="interfaceValues[id]"
          ></tag-picker>
          <layer-select
            :clearable="!item.required"
            v-if="item.type === 'layer'"
            v-model="interfaceValues[id]"
          ></layer-select>
          <v-select
            :clearable="!item.required"
            v-if="item.type === 'select'"
            v-model="interfaceValues[id]"
            :items="item.items"
          ></v-select>
          <channel-select
            :clearable="!item.required"
            v-if="item.type === 'channel'"
            v-model="interfaceValues[id]"
          ></channel-select>
          <v-checkbox
            v-if="item.type === 'checkbox'"
            v-model="interfaceValues[id]"
          ></v-checkbox>
        </v-col>
      </v-row>
    </v-list-item-group>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, VModel } from "vue-property-decorator";
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

  @VModel({ type: Object }) interfaceValues!: IWorkerInterfaceValues;

  getDefault(type: TWorkerInterfaceType, defaultValue?: TWorkerInterfaceValue) {
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
        return null;

      case "select":
        return "";

      case "channel":
        return 0;

      case "checkbox":
        return false;
    }
  }

  mounted() {
    this.resetValues();
  }

  @Watch("workerInterface")
  resetValues() {
    const interfaceValues: IWorkerInterfaceValues = {};
    for (const id in this.workerInterface) {
      const interfaceTemplate = this.workerInterface[id];
      interfaceValues[id] = this.getDefault(
        interfaceTemplate.type,
        interfaceTemplate.default
      );
    }
    this.interfaceValues = interfaceValues;
  }
}
</script>
