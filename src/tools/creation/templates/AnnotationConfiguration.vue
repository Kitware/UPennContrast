<template>
  <v-form ref="form" class="pa-0">
    <v-container class="px-0">
      <template v-if="!advanced">
        <!-- shape selection -->
        <v-row class="my-0" v-if="!hideShape">
          <v-col class="py-0">
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
        <v-row class="my-0" v-else>
          <v-col class="pt-0 pb-4 subtitle-2">
            Output shape type:
            {{ shape === null ? "nothing selected" : AnnotationNames[shape] }}
          </v-col>
        </v-row>
        <!-- layer location -->
        <v-row class="my-0">
          <v-col class="py-0">
            <layer-select v-model="coordinateAssignments.layer" label="Layer" />
          </v-col>
        </v-row>
        <!-- tags -->
        <v-row class="my-0">
          <v-col class="py-0">
            <tag-picker v-model="tags"></tag-picker>
          </v-col>
        </v-row>
      </template>
      <template v-else>
        <!-- Z and Time assignments -->
        <v-row>
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
                    :disabled="
                      coordinateAssignments[coordinate].type === 'layer'
                    "
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
      </template>
    </v-container>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import LayerSelect from "@/components/LayerSelect.vue";
import TagPicker from "@/components/TagPicker.vue";

import { AnnotationNames, AnnotationShape } from "@/store/model";

type VForm = Vue & { validate: () => boolean };

// Properties of AnnotationConfiguration that are emitted as input
const standardValueKeys = ["tags", "coordinateAssignments", "shape"];

// Interface element for configuring an annotation creation tool
@Component({
  components: {
    LayerSelect,
    TagPicker
  }
})
export default class AnnotationConfiguration extends Vue {
  readonly store = store;

  get dataset() {
    return this.store.dataset;
  }

  tagSearchInput: string = "";

  @Prop()
  readonly template!: any;

  @Prop()
  readonly hideShape!: string;

  @Prop({ default: AnnotationShape.Point })
  readonly defaultShape!: AnnotationShape;

  @Prop()
  readonly value!: any;

  @Prop()
  readonly advanced!: boolean;

  availableShapes = store.availableToolShapes;
  private AnnotationNames = AnnotationNames;

  label: string = "";
  shape: AnnotationShape = this.defaultShape;
  tags: string[] = [];

  get layers() {
    return this.store.layers;
  }

  get maxZ() {
    return this.store.dataset?.z.length || 0;
  }

  get maxTime() {
    return this.store.dataset?.time.length || 0;
  }

  get standardValue() {
    if (
      typeof this.value === "object" &&
      standardValueKeys.every(key => this.value.hasOwnProperty(key))
    ) {
      return this.value;
    } else {
      return null;
    }
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
  }

  @Watch("defaultShape")
  reset() {
    // Set internal values to the current input, or defaults
    this.coordinateAssignments = {
      layer: 0,
      Z: { type: "layer", value: 1, max: this.maxZ },
      Time: { type: "layer", value: 1, max: this.maxTime }
    };
    this.tags = [];
    this.shape = this.defaultShape;
    this.changed();
  }

  @Watch("coordinateAssignments.layer")
  @Watch("coordinateAssignments")
  @Watch("tags")
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

  // Synchronise advanced and basic attributes
  @Watch("standardValue")
  standardValueChanged() {
    if (!this.standardValue) {
      return;
    }
    let changed = false;
    standardValueKeys.forEach(key => {
      if ((this as any)[key] !== this.standardValue[key]) {
        (this as any)[key] = this.standardValue[key];
        changed = true;
      }
    });
    if (changed) {
      this.changed();
    }
  }
}
</script>
