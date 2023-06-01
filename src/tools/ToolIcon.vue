<template>
  <v-icon v-if="tool">{{ iconName }}</v-icon>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import { IToolConfiguration } from "@/store/model";

const toolTypeToIcon = {
  create: "mdi-shape-plus",
  snap: "mdi-arrow-collapse-vertical",
  select: "mdi-select-drag",
  edit: "mdi-vector-polygon",
  segmentation: "mdi-shape-polygon-plus",
  connection: "mdi-vector-line"
} as const;

const createShapeToIcon = {
  point: "mdi-dots-hexagon",
  polygon: "mdi-vector-polygon",
  line: "mdi-chart-timeline-variant"
} as const;

type toolType = keyof typeof toolTypeToIcon;
type shape = keyof typeof createShapeToIcon;
@Component({})
export default class ToolIcon extends Vue {
  @Prop()
  readonly tool: IToolConfiguration | undefined;

  get iconName() {
    if (this.tool) {
      if (this.tool.type === "create") {
        const shape = this.tool.values?.annotation?.shape as shape;
        if (shape) {
          return createShapeToIcon[shape];
        }
      }
      const type = this.tool.type as toolType;
      return toolTypeToIcon[type];
    }
    return "";
  }
}
</script>
