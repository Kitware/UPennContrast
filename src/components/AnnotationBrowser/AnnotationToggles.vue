<template>
  <div>
    <v-subheader>Annotation Controls</v-subheader>
    <v-list dense>
      <v-list-item>
        <v-checkbox
          hide-details
          v-model="drawAnnotations"
          dense
          label="Show Annotations"
        ></v-checkbox>
      </v-list-item>
    </v-list>
    <v-list dense value="true">
      <v-list-item>
        <v-checkbox
          hide-details
          :disabled="!drawAnnotations"
          dense
          label="Restrict to Filters"
        ></v-checkbox>
      </v-list-item>
      <v-list-item>
        <v-checkbox
          hide-details
          :disabled="!drawAnnotations"
          dense
          label="Show Only Active "
        ></v-checkbox>
      </v-list-item>
      <v-list-item>
        <v-checkbox
          hide-details
          :disabled="!drawAnnotations"
          dense
          label="Show Connections"
        ></v-checkbox>
      </v-list-item>
    </v-list>
  </div>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {}
})
export default class AnnotationToggles extends Vue {
  readonly store = store;

  get drawAnnotations() {
    return this.store.drawAnnotations;
  }

  set drawAnnotations(value: boolean) {
    this.store.setDrawAnnotations(value);
  }

  get drawConnections() {
    return this.store.drawAnnotationConnections;
  }

  set drawConnections(value: boolean) {
    this.store.setDrawAnnotationConnections(value);
  }
}
</script>
