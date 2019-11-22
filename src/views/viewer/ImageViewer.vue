<template>
  <div class="image">
    <canvas ref="canvas" :data-update="reactiveDraw" />
    <resize-observer @notify="handleResize" />
  </div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import { Route, RawLocation } from "vue-router";
import { IGirderItem } from "@/girder";

@Component
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;
  private width = 10;
  private height = 10;
  private image: HTMLImageElement | null = null;

  $refs!: {
    canvas: HTMLCanvasElement;
  };

  mounted() {
    this.refsMounted = true;
    this.handleResize();
  }

  @Watch("store.selectedItem")
  protected async reloadImage(value: IGirderItem) {
    if (!value) {
      this.image = null;
      return;
    }
    this.store.api.getImage(value).then(image => {
      this.image = image;
    });
  }

  handleResize() {
    const { width, height } = this.$el.getBoundingClientRect();
    this.width = width - 1;
    this.height = height - 1;
  }

  get reactiveDraw() {
    if (!this.refsMounted || !this.$refs.canvas) {
      return;
    }
    this.draw(this.$refs.canvas);
  }

  private draw(canvas: HTMLCanvasElement) {
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillRect(10, 10, 10, 10);

    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    }
  }
}
</script>

<style lang="scss" scoped>
.image {
  position: absolute;
  left: 0;
  top: 0;
  right: 1px;
  bottom: 1px;
}
</style>
