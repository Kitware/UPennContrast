<template>
  <v-form>
    <v-text-field label="Annotation Name" v-model="name" @change="changed" />
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
        <v-col v-for="(coordinate, index) in coordinates" :key="index">
          <v-radio-group
            @change="changed"
            :label="coordinate"
            v-model="coordinateAssignments[coordinate]"
            :key="`${index}Radio`"
          >
            <v-radio value="current" label="Current"></v-radio>
            <v-radio value="assign">
              <template v-slot:label>
                <span>Assign</span>
                <v-select
                  :key="`${index}Select`"
                  :disabled="coordinateAssignments[coordinate] === 'current'"
                  :items="channels"
                  v-model="assignmentValues[coordinate]"
                  v-if="coordinate === 'Channel'"
                  class="pl-12"
                />
                <!-- TODO: make sure we have numbers -->
                <v-text-field
                  v-else
                  type="number"
                  :min="0"
                  class="pl-12"
                  v-model="assignmentValues[coordinate]"
                  @change="changed"
                  :disabled="coordinateAssignments[coordinate] === 'current'"
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

  tagSearchInput: string = "";

  @Prop()
  readonly template!: any;

  @Prop()
  readonly value!: any;

  // TODO: change ofc
  availableShapes = [
    { text: "Point", value: "point" },
    { text: "Line", value: "line" },
    { text: "Blob", value: "polygon" }
  ];

  name: string = "";
  shape: string = "";
  tags: string[] = [];
  coordinates = ["Channel", "XY", "Z", "Time"];
  coordinateAssignments = {};
  assignmentValues = {};

  mounted() {
    this.resetValues();
    this.changed();
  }

  @Watch("value")
  resetValues() {
    // Set internal values to the current input, or defaults
    this.coordinateAssignments = this.value?.coordinateAssignments || {
      Channel: "current",
      XY: "current",
      Z: "current",
      Time: "current"
    };
    this.assignmentValues = this.value?.assignmentValues || {
      Channel: 0,
      XY: 0,
      Z: 0,
      Time: 0
    };
    this.name = this.value?.name || "New Annotation";
    this.tags = this.value?.tags || [];
    this.shape = this.value?.shape || "point";
    // inf ?
    // this.changed();
  }

  changed() {
    this.tagSearchInput = "";
    this.$emit("input", {
      name: this.name,
      tags: this.tags,
      coordinateAssignments: this.coordinateAssignments,
      assignmentValues: this.assignmentValues,
      shape: this.shape
    });
    this.$emit("change");
  }

  // TODO: validation
  // TODO: shape selection
  // TODO: color selection
}
</script>
