<template>
  <div :class="{ background: !singleLayer }">
    <v-row dense v-if="!singleLayer" class="pl-4 py-1 pr-8">
      <v-col class="textCol">
        <div class="subtitle-1">Group</div>
      </v-col>
      <v-col class="denseCol">
        <v-switch
          @click.native.stop
          @mousedown.native.stop
          @mouseup.native.stop
          class="toggleButton"
          v-model="isZMaxMerge"
          :title="`Toggle Z Max Merge for all layers`"
          v-show="hasMultipleZ"
          dense
          hide-details
        />
      </v-col>
      <v-col class="denseCol">
        <v-switch
          @click.native.stop
          @mousedown.native.stop
          @mouseup.native.stop
          class="toggleButton"
          v-model="visible"
          :title="`Toggle Visibility for all layers`"
          dense
          hide-details
        />
      </v-col>
    </v-row>
    <draggable
      v-bind="$attrs"
      :value="combinedLayers"
      :class="{ 'draggable-group': !singleLayer }"
      :animation="200"
      :fallbackOnBody="true"
      :swapThreshold="0.65"
      @start="startDragging"
      @end="endDragging"
      @input="update"
    >
      <transition-group type="transition">
        <v-card
          v-for="combinedLayer in combinedLayers"
          :key="combinedLayer.layer.id"
          class="mb-1 mx-1"
        >
          <display-layer ref="displayLayers" :value="combinedLayer.layer" />
        </v-card>
      </transition-group>
    </draggable>
  </div>
</template>

<script lang="ts">
import { ICombinedLayer } from "@/store/model";
import { SortableEvent } from "sortablejs";
import { Vue, Component, Prop } from "vue-property-decorator";
import DisplayLayer from "./DisplayLayer.vue";
import draggable from "vuedraggable";
import store from "@/store";

@Component({
  components: {
    DisplayLayer,
    draggable,
  },
})
export default class DisplayLayerGroup extends Vue {
  readonly store = store;
  @Prop()
  readonly singleLayer!: boolean;

  @Prop()
  readonly combinedLayers!: ICombinedLayer[];

  displayLayers: DisplayLayer[] = [];

  $refs!: {
    displayLayers: DisplayLayer[];
  };

  mounted() {
    this.displayLayers = this.$refs.displayLayers;
  }

  get hasMultipleZ() {
    return this.store.dataset && this.store.dataset.z.length > 1;
  }

  get isZMaxMerge() {
    return this.displayLayers.every((displayLayer) => displayLayer.isZMaxMerge);
  }

  set isZMaxMerge(value: boolean) {
    this.displayLayers.forEach(
      (displayLayer) => (displayLayer.isZMaxMerge = value),
    );
  }

  get visible() {
    return this.displayLayers.every((displayLayer) => displayLayer.visible);
  }

  set visible(value: boolean) {
    this.displayLayers.forEach(
      (displayLayer) => (displayLayer.visible = value),
    );
  }

  update(value: ICombinedLayer[]) {
    this.$emit("update", value);
  }

  startDragging(e: SortableEvent) {
    this.$emit("start", e);
  }

  endDragging(e: SortableEvent) {
    this.$emit("end", e);
  }
}
</script>

<style lang="scss" scoped>
.draggable-group {
  margin-left: 6px;
}

.background {
  border-radius: 14px;
  background-color: grey;
}
</style>

<style>
.denseCol {
  flex-grow: 0;
}

.textCol {
  overflow: hidden;
}
</style>
