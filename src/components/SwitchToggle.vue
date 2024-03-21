<template>
  <v-switch
    v-model="valueInternal"
    :label="trueLabel"
    hide-details
    :id="id"
    :true-value="trueValue"
    :false-value="falseValue"
  >
    <template #prepend>
      <label
        :class="{
          'v-label': true,
          'theme--light': !$vuetify.theme.dark,
          'theme--dark': $vuetify.theme.dark,
        }"
        :for="id"
      >
        {{ label }} {{ falseLabel }}
      </label>
    </template>
  </v-switch>
</template>
<style>
.v-input--selection-controls > .v-input__prepend-outer {
  white-space: nowrap;
  margin-top: 2px;
}
.v-input--selection-controls {
  margin-top: 8px;
}
</style>
<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class SwitchToggle extends Vue {
  @Prop()
  id!: string;
  @Prop()
  value!: string;
  @Prop()
  trueLabel!: string;
  @Prop()
  trueValue!: string;
  @Prop()
  falseLabel!: string;
  @Prop()
  falseValue!: string;
  @Prop()
  label!: string;

  get valueInternal() {
    return this.value;
  }

  set valueInternal(value: string) {
    this.$emit("input", value);
  }
}
</script>
