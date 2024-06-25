<template>
  <v-menu
    :close-on-content-click="false"
    transition="scale-transition"
    offset-x
  >
    <template #activator="{ on }">
      <div
        v-on="on"
        v-bind="{
          class: $vnode.data && $vnode.data.staticClass,
          style: $vnode.data && $vnode.data.staticStyle,
        }"
        style="cursor: pointer"
        class="d-flex align-center"
      >
        <span class="subtitle-2 mr-2">Color</span>
        <span :style="{ backgroundColor: color }" class="color-bar"></span>
      </div>
    </template>
    <v-color-picker v-model="color" />
  </v-menu>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";

@Component({ inheritAttrs: false })
export default class ColorPickerMenu extends Vue {
  @VModel({ type: String, default: "#FFFFFF" }) color!: string;
}
</script>

<style lang="scss" scoped>
.color-bar {
  border-radius: 6px;
  width: 100%;
  height: 1em;
  border: 2px solid grey;
}
</style>

<style lang="scss">
.v-color-picker__dot {
  box-shadow: 0px 0px 5px grey;
}

.v-color-picker .v-color-picker__controls .v-color-picker__edit i {
  border: solid 2px grey;
  border-radius: 5px;
  padding: 12px;
}
</style>
