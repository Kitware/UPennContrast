<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Actions
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row
          ><v-col><v-btn @click="deleteSelected">Delete Selected</v-btn></v-col>
          <v-col><v-btn @click="tagSelected">Tag Selected</v-btn></v-col>
          <v-col
            ><v-btn @click="connectSelected">Connect Selected</v-btn></v-col
          ></v-row
        >
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import annotationStore from "@/store/annotation";

@Component({
  components: {}
})
export default class AnnotationActions extends Vue {
  readonly annotationStore = annotationStore;

  deleteSelected() {
    this.annotationStore.deleteSelectedAnnotations();
  }

  deleteInactive() {
    this.annotationStore.deleteInactiveAnnotations();
  }

  activateSelected() {
    this.annotationStore.activateSelectedAnnotations();
  }
  inactivateSelected() {
    this.annotationStore.deactivateSelectedAnnotations();
  }

  tagSelected() {
    // TODO:
  }

  connectSelected() {
    // TODO:
  }
}
</script>
