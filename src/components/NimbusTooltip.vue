<template>
  <v-tooltip
    :top="position === 'top'"
    :right="position === 'right'"
    :bottom="position === 'bottom'"
    :left="position === 'left'"
    :activator="activator"
    :open-delay="open_delay"
  >
    <span>{{ content }}</span>
  </v-tooltip>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "NimbusTooltip",
  props: {
    activator: { required: true },
    content: { type: String, required: true },
    position: { type: String, required: false, default: "bottom" },
    open_delay: { type: Number, default: 0 },
  },
});
</script>
