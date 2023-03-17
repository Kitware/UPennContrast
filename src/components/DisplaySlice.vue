<template>
  <v-radio-group
    :value="value.type"
    @change="changeSlice($event, value.value)"
    :label="labelHint"
    hide-details
    dense
  >
    <template v-if="maxValue > 0">
      <v-radio value="current" label="Current" class="smaller" />

      <v-radio value="constant" class="inline-text smaller">
        <template #label>
          <span>Constant</span>
          <v-text-field
            v-show="value.type === 'constant'"
            :value="(value.value || 0) + offset"
            :min="offset"
            :max="maxValue + offset"
            type="number"
            dense
            hide-details
            @input="changeSlice('constant', $event)"
          />
        </template>
      </v-radio>
      <v-radio
        value="offset"
        class="inline-text smaller"
        :disabled="maxValue === 0"
      >
        <template #label>
          <span>Offset</span>
          <v-text-field
            v-show="value.type === 'offset'"
            :value="value.value || 0"
            type="number"
            dense
            :min="minOffsetValue"
            :max="maxOffsetValue"
            hide-details
            @input="changeSlice('offset', $event)"
          />
        </template>
      </v-radio>
      <v-radio value="max-merge" label="Max Merge" class="smaller" />
    </template>
  </v-radio-group>
</template>
<style>
.v-input--radio-group--column .v-input--radio-group__input > .v-label {
  padding-bottom: 2px;
}
</style>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { IDisplaySlice, TDisplaySliceType } from "../store/model";
import store from "@/store";

@Component
export default class DisplaySlice extends Vue {
  readonly store = store;
  @Prop()
  readonly value!: IDisplaySlice;
  @Prop()
  readonly maxValue!: number;
  @Prop()
  readonly label!: string;
  @Prop()
  readonly displayed!: number;
  @Prop()
  readonly offset!: number;

  get maxOffsetValue() {
    return this.maxValue;
  }

  get minOffsetValue() {
    return -this.maxValue;
  }

  get labelHint() {
    if (this.maxValue === 0) {
      return `${this.label} (no slices available)`;
    }
    return this.label;
  }

  changeSlice(type: TDisplaySliceType, value: string | number | null) {
    const inputValue =
      typeof value === "string" ? parseInt(value, 10) : value || 0;

    const typeHasChanged = this.value.type !== type;
    if (
      (!typeHasChanged && this.value.value === value) ||
      (!inputValue && inputValue !== 0)
    ) {
      return;
    }

    let validated = inputValue;
    switch (type) {
      case "constant":
        const constantValue =
          inputValue !== null ? inputValue - this.offset : null;

        validated =
          constantValue == null || typeHasChanged
            ? this.displayed
            : Math.max(Math.min(constantValue, this.maxValue), 0);
        break;
      case "offset":
        validated =
          inputValue == null || typeHasChanged
            ? 0
            : Math.max(
                Math.min(inputValue, this.maxOffsetValue),
                this.minOffsetValue
              );
        break;
      default:
        validated = 0;
        break;
    }
    this.$emit("change", {
      type,
      value: validated
    });
  }
}
</script>

<style lang="scss" scoped>
.smaller {
  margin-bottom: 0 !important;

  ::v-deep .v-label {
    font-size: 14px;
    height: auto;
  }
}

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
