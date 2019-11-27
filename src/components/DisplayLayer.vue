<template>
  <div :class="{ displayLayer: true, notVisible: !value.visible }">
    <v-switch
      class="toggleButton"
      :value="value.visible"
      @change="changeProp('visible', $event)"
      :label="`Visible (Hotkey: ${index + 1})`"
      dense
      hide-details
    />
    <v-text-field
      :value="value.name"
      @change="changeProp('name', $event)"
      label="Name"
      dense
    />
    <v-menu
      ref="colorMenu"
      v-model="showColorPicker"
      :close-on-content-click="false"
      :nudge-right="40"
      transition="scale-transition"
      offset-y
      max-width="300px"
      min-width="300px"
    >
      <template #activator="{ on }">
        <v-text-field
          :value="value.color"
          @change="changeProp('color', $event)"
          label="Picker in menu"
          readonly
          dense
          v-on="on"
        >
          <template #append>
            <v-icon :color="value.color">mdi-square</v-icon>
          </template>
        </v-text-field>
      </template>
      <v-color-picker
        v-if="showColorPicker"
        :value="value.color"
        @input="changeProp('color', $event)"
        width="300"
      />
    </v-menu>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit } from "vue-property-decorator";
import { IDimension, IDisplayLayer } from "../store/model";
import store from "../store";

@Component
export default class Contrast extends Vue {
  readonly store = store;
  @Prop()
  readonly value!: IDisplayLayer;

  @Prop()
  readonly index!: number;

  showColorPicker = false;

  changeProp(prop: keyof IDisplayLayer, value: any) {
    if (this.value[prop] === value) {
      return;
    }
    this.store.changeLayer({
      index: this.index,
      delta: {
        [prop]: value
      }
    });
  }
}
</script>
<style lang="scss" scoped>
.displayLayer {
  &.notVisible > :not(.toggleButton) {
    opacity: 0.5;
  }
}
.toggleButton {
  justify-content: center;
}
</style>
