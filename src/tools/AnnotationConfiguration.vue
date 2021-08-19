<template>
  <v-form>
    <v-text-field label="Annotation Name" v-model="label" @change="changed" />
    <v-combobox
      v-model="tags"
      :items="tagList"
      :search-input.sync="tagSearchInput"
      @change="changed"
      label="Assign Tags"
      multiple
      hide-selected
      small-chips
      dense
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
    <v-select
      label="Shape"
      :items="availableShapes"
      v-model="shape"
      @change="changed"
    >
    </v-select>
    <v-container fluid>
      <v-row>
        <v-col>
          <v-subheader>Layer</v-subheader>
          <v-select
            :items="layerItems"
            item-text="label"
            dense
            label="Choose a layer"
            v-model="coordinateAssignments.layer"
            @change="changed"
          />
        </v-col>
        <v-col v-for="(coordinate, index) in coordinates" :key="index">
          <v-radio-group
            @change="changed"
            :label="coordinate"
            v-model="coordinateAssignments[coordinate].type"
            :key="`${index}Radio`"
          >
            <v-radio value="layer" label="From Layer"></v-radio>
            <v-radio value="assign">
              <template v-slot:label>
                <span>Assign</span>
                <v-text-field
                  type="number"
                  :min="0"
                  class="pl-12"
                  v-model="coordinateAssignments[coordinate].value"
                  @change="changed"
                  :disabled="coordinateAssignments[coordinate].type === 'layer'"
                />
                <!-- TODO: min/max/increment, default at current slice -->
              </template>
            </v-radio>
          </v-radio-group>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {}
})
export default class AnnotationConfiguration extends Vue {
  readonly store = store;

  tagList = []; // TODO: keep list of existing annotation tags ?

  get dataset() {
    return this.store.dataset;
  }
  get channels() {
    return (
      this.dataset?.channels.map(channelId => ({
        value: channelId,
        text: this.dataset?.channelNames.get(channelId)
      })) || []
    );
  }

  get layers() {
    return this.store.configuration?.view.layers || [];
  }

  get layerItems() {
    return this.layers.map((layer, index) => ({
      label: layer.name,
      value: index
    }));
  }

  tagSearchInput: string = "";

  @Prop()
  readonly template!: any;

  @Prop()
  readonly value!: any;

  availableShapes = [
    { text: "Point", value: "point" },
    { text: "Line", value: "line" },
    { text: "Blob", value: "polygon" }
  ];

  label: string = "";
  shape: string = "";
  tags: string[] = [];

  coordinates = ["Z", "Time"];
  coordinateAssignments = {
    layer: 0,
    Z: { type: "layer", value: 1 },
    Time: { type: "layer", value: 1 }
  };

  mounted() {
    this.resetValues();
    this.changed();
  }

  @Watch("value")
  resetValues() {
    // Set internal values to the current input, or defaults
    this.coordinateAssignments = this.value?.coordinateAssignments || {
      layer: 0,
      Z: { type: "layer", value: 1 },
      Time: { type: "layer", value: 1 }
    };

    this.label = this.value?.label || "New Annotation";
    this.tags = this.value?.tags || [];
    this.shape = this.value?.shape || "point";
    // inf ?
    // this.changed();
  }

  changed() {
    this.tagSearchInput = "";
    this.$emit("input", {
      label: this.label,
      tags: this.tags,
      coordinateAssignments: this.coordinateAssignments,
      shape: this.shape
    });
    this.$emit("change");
  }
}
</script>
