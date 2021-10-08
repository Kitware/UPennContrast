<template>
  <v-card>
    <v-card-actions>
      <v-container>
        <v-row
          ><v-col><v-btn @click="deleteSelected">Delete Selected</v-btn></v-col>
          <v-col
            ><v-btn @click="deleteInactive">Delete Inactive</v-btn></v-col
          ></v-row
        >
        <v-row
          ><v-col
            ><v-btn @click="activateSelected">Activate Selected</v-btn></v-col
          >

          <v-col
            ><v-btn @click="inactivateSelected"
              >Inactivate Selected</v-btn
            ></v-col
          ></v-row
        >
        <v-row
          ><v-col><v-btn @click="tagSelected">Tag Selected</v-btn></v-col>
          <v-col
            ><v-btn @click="connectSelected">Connect Selected</v-btn></v-col
          ></v-row
        >
        <!-- <v-row><v-btn @click="">Act On Selected</v-btn></v-row> -->
      </v-container>
    </v-card-actions>
  </v-card>
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
    // TODO: probably "delete inactive within filters"
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
