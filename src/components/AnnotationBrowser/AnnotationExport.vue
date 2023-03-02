<template>
  <v-dialog v-model="dialog">
    <template v-slot:activator="{ on, attrs }">
      <v-btn v-bind="{ ...attrs, ...$attrs }" v-on="on">
        <v-icon>mdi-export</v-icon>
        Export to JSON
      </v-btn>
    </template>
    <v-card class="pa-2" :disabled="!canExport">
      <v-card-title>
        Export
      </v-card-title>
      <v-card-text class="pt-5 pb-0">
        <v-checkbox v-model="exportAnnotations" label="Export annotations" />
        <v-checkbox
          v-model="exportConnections"
          :disabled="!exportAnnotations"
          label="Export annotation connections"
        />
        <v-checkbox v-model="exportProperties" label="Export properties" />
        <v-checkbox
          v-model="exportValues"
          :disabled="!exportProperties || !exportAnnotations"
          label="Export property values"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="submit" color="primary">
          Export selection
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationProperty,
  IAnnotationPropertyValues,
  ISerializedData
} from "@/store/model";
import { downloadToClient } from "@/utils/download";

@Component({})
export default class AnnotationImport extends Vue {
  readonly store = store;

  dialog = false;

  exportAnnotations = true;
  exportConnections = true;
  exportProperties = true;
  exportValues = true;

  get canExport() {
    return !!store.dataset;
  }

  submit() {
    let annotationPromise: Promise<IAnnotation[]> = Promise.resolve([]);
    if (this.exportAnnotations) {
      annotationPromise = store.annotationsAPI.getAnnotationsForDatasetId(
        store.dataset!.id
      );
    }

    let connectionsPromise: Promise<IAnnotationConnection[]> = Promise.resolve(
      []
    );
    if (this.exportConnections && this.exportAnnotations) {
      connectionsPromise = store.annotationsAPI.getConnectionsForDatasetId(
        store.dataset!.id
      );
    }

    let propertiesPromise: Promise<IAnnotationProperty[]> = Promise.resolve([]);
    if (this.exportProperties) {
      propertiesPromise = store.propertiesAPI.getProperties();
    }

    let valuesPromise: Promise<IAnnotationPropertyValues> = Promise.resolve({});
    if (this.exportValues) {
      valuesPromise = store.propertiesAPI.getPropertyValues(store.dataset!.id);
    }

    Promise.all([
      annotationPromise,
      connectionsPromise,
      propertiesPromise,
      valuesPromise
    ]).then(
      ([
        annotations,
        annotationConnections,
        annotationProperties,
        annotationPropertyValues
      ]) => {
        const serializable: ISerializedData = {
          annotations,
          annotationConnections,
          annotationProperties,
          annotationPropertyValues
        };
        const href =
          "data:text/plain;charset=utf-8," +
          encodeURIComponent(JSON.stringify(serializable));

        downloadToClient({ href, download: "upennExport.json" });
        this.dialog = false;
      }
    );
  }
}
</script>
