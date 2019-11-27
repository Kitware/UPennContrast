<template>
  <v-radio-group
    :value="value.type"
    @change="changeSlice($event, value.value)"
    :label="label"
    hide-details
    dense
  >
    <v-radio value="current" label="Current" />

    <v-radio value="constant" class="inline-text">
      <template #label>
        <span>Constant</span>
        <v-text-field
          :disabled="value.type !== 'constant'"
          :value="value.value || 0"
          type="number"
          dense
          hide-details
          @change="changeSlice('constant', $event)"
        />
      </template>
    </v-radio>
    <v-radio value="offset" class="inline-text">
      <template #label>
        <span>Offset</span>
        <v-text-field
          :disabled="value.type !== 'offset'"
          :value="value.value || 0"
          type="number"
          dense
          hide-details
          @change="changeSlice('offset', $event)"
        />
      </template>
    </v-radio>
    <v-radio value="max-merge" label="Max Merge" />
  </v-radio-group>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import { IDisplaySlice, DisplaySliceType } from "../store/model";

@Component
export default class DisplaySlice extends Vue {
  @Prop()
  readonly value!: IDisplaySlice;
  @Prop()
  readonly maxValue!: number;
  @Prop()
  readonly label!: string;

  changeSlice(type: DisplaySliceType, value: number | null) {
    if (this.value.type === type && this.value.value === value) {
      return;
    }
    this.$emit("change", {
      type,
      value: type === "constant" || type === "offset" ? value : null
    });
  }
}
</script>

<style lang="scss" scoped>
.inline-text {
  span {
    width: 6em;
  }

  .v-text-field {
    font-size: 12px;
    margin: 0;

    ::v-deep input {
      padding: 0 !important;
    }
  }
}
</style>
