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
      <!--styling helper -->
      <div class="v-input--selection-controls__input" style="width: 0"></div>
      <label class="v-label theme--dark" :for="id">
        {{ label }} {{ falseLabel }}
      </label>
    </template>
  </v-switch>
</template>
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
