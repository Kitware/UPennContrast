<template>
  <v-slider
    v-model="slider"
    :max="max + offset"
    :min="min + offset"
    hide-details
    :label="label"
    :disabled="min === max"
  >
    <template #append>
      <v-container>
        <v-row>
          <v-col class="pa-0">
            <v-text-field
              v-model="slider"
              class="mt-0 pt-0"
              hide-details
              single-line
              type="number"
              :min="min + offset"
              :max="max + offset"
              :disabled="min === max"
              style="width: 60px"
              dense
            >
            </v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col class="text-right pa-0">
            <span class="mt-2 caption font-weight-light">{{
              `of ${max + offset}`
            }}</span>
          </v-col>
        </v-row>
      </v-container>
    </template>
  </v-slider>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class ValueSlider extends Vue {
  @Prop()
  readonly value!: number;
  @Prop()
  readonly min!: number;
  @Prop()
  readonly max!: number;
  @Prop()
  readonly label!: string;
  @Prop({ default: 0 })
  readonly offset!: number;

  private internalValue = this.value;

  get slider() {
    return this.internalValue;
  }

  set slider(value: number) {
    const numberValue = typeof value === "number" ? value : parseInt(value);
    if (numberValue == this.internalValue) {
      return;
    }
    this.internalValue = numberValue;
    this.$emit("input", numberValue - this.offset);
  }

  private updateInternalValue() {
    this.internalValue = this.value + this.offset;
  }

  mounted() {
    this.updateInternalValue();
  }

  @Watch("value")
  watchValue() {
    this.updateInternalValue();
  }
}
</script>
