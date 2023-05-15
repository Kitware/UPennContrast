<template>
  <div :class="{ background: !singleLayer }">
    <div v-if="!singleLayer" class="pl-4 py-1 subtitle-1">
      Group
    </div>
    <draggable
      v-bind="$attrs"
      :value="indexedLayers"
      :class="{ 'draggable-group': !singleLayer }"
      :animation="200"
      :fallbackOnBody="true"
      :swapThreshold="0.65"
      @start="startDragging"
      @end="endDragging"
      @input="update"
    >
      <transition-group type="transition">
        <div v-for="indexedLayer in indexedLayers" :key="indexedLayer.layerIdx">
          <display-layer
            :value="indexedLayer.layer"
            :index="indexedLayer.layerIdx"
          />
        </div>
      </transition-group>
    </draggable>
  </div>
</template>

<script lang="ts">
import { IIndexedLayer } from "@/store/model";
import { SortableEvent } from "sortablejs";
import { Vue, Component, Prop } from "vue-property-decorator";
import DisplayLayer from "./DisplayLayer.vue";
import draggable from "vuedraggable";
import store from "@/store";

@Component({
  components: {
    DisplayLayer,
    draggable
  }
})
export default class DisplayLayerGroup extends Vue {
  readonly store = store;
  @Prop()
  readonly singleLayer!: boolean;

  @Prop()
  readonly indexedLayers!: IIndexedLayer[];

  update(value: IIndexedLayer[]) {
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
