<template>
  <div>
    <v-chip-group v-model="tags" column multiple active-class="selected-chip">
      <v-chip
        v-for="tag in availableTags"
        :key="tag"
        :value="tag"
        :class="{
          'selected-chip': tags.includes(tag),
        }"
        outlined
        x-small
      >
        {{ tag }}
      </v-chip>
    </v-chip-group>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, VModel } from "vue-property-decorator";

@Component
export default class TagCloudPicker extends Vue {
  @Prop({ type: Array, default: () => [] })
  readonly availableTags!: string[];

  @VModel({ type: Array, default: () => [] })
  tags!: string[];
}
</script>

<style scoped>
.selected-chip {
  border-color: #ffffff !important;
}

.v-chip {
  transition:
    background-color 0.3s,
    color 0.3s;
}
</style>
