<template>
  <v-form ref="form">
    <v-container>
      <v-row>
        <v-col>
          <!-- tags -->
          <v-combobox
            v-model="tags"
            :items="tagList"
            :search-input.sync="tagSearchInput"
            @change="changed"
            label="Tags"
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
        </v-col>
        <v-col>
          <!-- shape selection -->
          <v-select
            label="Shape"
            :items="availableShapes"
            v-model="shape"
            @change="changed"
            dense
          >
          </v-select>
        </v-col>
      </v-row>
      <!-- location -->
      <v-row>
        <v-col class="py-0">
          <v-subheader class="pa-0">Layer</v-subheader>
          <!-- layer -->
          <v-select
            :items="layerItems"
            item-text="label"
            dense
            v-model="coordinateAssignments.layer"
            @change="changed"
          />
        </v-col>
        <!-- Z and Time assignments -->
        <v-col
          v-for="(coordinate, index) in coordinates"
          :key="index"
          class="py-0"
        >
          <v-radio-group
            @change="changed"
            :label="coordinate"
            v-model="coordinateAssignments[coordinate].type"
            :key="`${index}Radio`"
            mandatory
            dense
          >
            <v-radio
              value="layer"
              label="From Layer"
              v-if="!isMaxMerge(coordinate, coordinateAssignments.layer)"
            ></v-radio>
            <v-radio value="assign">
              <template v-slot:label>
                <span>Assign</span>
                <v-text-field
                  dense
                  type="number"
                  :min="0"
                  class="pl-4"
                  v-model="coordinateAssignments[coordinate].value"
                  @change="changed"
                  :disabled="coordinateAssignments[coordinate].type === 'layer'"
                  :style="{ width: 'min-content' }"
                  :rules="[
                    val =>
                      Number.parseInt(val) <
                      coordinateAssignments[coordinate].max
                  ]"
                />
              </template>
            </v-radio>
          </v-radio-group>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import { IToolConfiguration } from "@/store/model";

type VForm = Vue & { validate: () => boolean };

// Interface element for configuring an annotation creation tool
@Component({
  components: {}
})
export default class AnnotationConfiguration extends Vue {
  readonly store = store;

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

  get tagList(): string[] {
    return this.store.tools
      .filter(
        (tool: IToolConfiguration) =>
          (tool.type === "create" || tool.type === "snap") &&
          tool.values.annotation
      )
      .map((tool: IToolConfiguration) => tool.values.annotation.tags)
      .flat();
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

  get maxZ() {
    return this.store.dataset?.z.length || 0;
  }

  get maxTime() {
    return this.store.dataset?.time.length || 0;
  }

  isMaxMerge(axis: string, layerIndex: number) {
    const layer = this.layers[layerIndex];
    if (!layer) {
      return false;
    }
    const key = axis === "Z" ? "z" : "time";
    return layer[key].type === "max-merge";
  }

  coordinates = ["Z", "Time"];
  coordinateAssignments = {
    layer: 0,
    Z: { type: "layer", value: 1, max: this.maxZ },
    Time: { type: "layer", value: 1, max: this.maxTime }
  };

  mounted() {
    this.reset();
    if (!this.store.tools?.length) {
      this.store.fetchAvailableTools();
    }
  }

  reset() {
    // Set internal values to the current input, or defaults
    this.coordinateAssignments = {
      layer: 0,
      Z: { type: "layer", value: 1, max: this.maxZ },
      Time: { type: "layer", value: 1, max: this.maxTime }
    };
    this.tags = [];
    this.shape = "point";

    this.changed();
  }

  changed() {
    const form = this.$refs.form as VForm;
    if (!form?.validate()) {
      if (this.coordinateAssignments.Z.value > this.maxZ) {
        this.coordinateAssignments.Z.value = this.maxZ;
      }
      if (this.coordinateAssignments.Time.value > this.maxTime) {
        this.coordinateAssignments.Time.value = this.maxTime;
      }
    }
    this.tagSearchInput = "";
    this.$emit("input", {
      tags: this.tags,
      coordinateAssignments: this.coordinateAssignments,
      shape: this.shape
    });
    this.$emit("change");
  }
}
</script>
