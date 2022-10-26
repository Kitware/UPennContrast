<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Actions
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row
          ><v-col><v-btn @click="deleteSelected">Delete Selected</v-btn></v-col>
          <v-col>
            <v-dialog v-model="tagSelectedDialog" width="50%">
              <template v-slot:activator="{ on, attrs }">
                <v-btn v-bind="attrs" v-on="on">Tag Selected</v-btn>
              </template>
              <v-card>
                <v-card-title>
                  Add tags to selected annotations
                </v-card-title>
                <tag-picker class="ma-4 pa-4" v-model="tagsToAdd"></tag-picker>
                <v-divider></v-divider>
                <v-card-actions>
                  <v-spacer></v-spacer>
                  <v-btn color="warning" @click="tagsToAdd = []">
                    Clear
                  </v-btn>
                  <v-btn color="primary" @click="tagSelected">
                    Submit
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-col>
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
import TagPicker from "@/components/TagPicker.vue";

@Component({
  components: { TagPicker }
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

  tagSelectedDialog: boolean = false;
  tagsToAdd: string[] = [];
  tagSelected() {
    this.annotationStore.tagSelectedAnnotations(this.tagsToAdd);
    this.tagSelectedDialog = false;
    this.tagsToAdd = [];
  }

  connectSelected() {
    // TODO:
  }
}
</script>
