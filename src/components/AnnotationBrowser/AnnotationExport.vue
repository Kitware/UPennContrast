<template>
  <v-dialog v-model="dialog">
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        v-bind="{ ...attrs, ...$attrs }"
        v-on="on"
        v-description="{
          section: 'Object list actions',
          title: 'Export to JSON',
          description: 'Export annotations and connections to a JSON file'
        }"
      >
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
        <v-textarea
          v-model="filename"
          class="my-2"
          label="File name"
          rows="1"
          no-resize
          hide-details
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
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";

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
  readonly propertyStore = propertyStore;

  dialog = false;

  exportAnnotations = true;
  exportConnections = true;
  exportProperties = true;
  exportValues = true;

  filename: string = "";

  get dataset() {
    return this.store.dataset;
  }

  get canExport() {
    return !!this.store.dataset;
  }

  mounted() {
    this.resetFilename();
  }

  @Watch("dataset")
  resetFilename() {
    this.filename = (this.dataset?.name ?? "unknown") + ".json";
  }

  submit() {
    let annotationPromise: Promise<IAnnotation[]> = Promise.resolve([]);
    if (this.exportAnnotations) {
      annotationPromise = this.store.annotationsAPI.getAnnotationsForDatasetId(
        this.dataset!.id
      );
    }

    let connectionsPromise: Promise<IAnnotationConnection[]> = Promise.resolve(
      []
    );
    if (this.exportConnections && this.exportAnnotations) {
      connectionsPromise = this.store.annotationsAPI.getConnectionsForDatasetId(
        this.dataset!.id
      );
    }

    let propertiesPromise: Promise<IAnnotationProperty[]> = Promise.resolve([]);
    if (this.exportProperties) {
      propertiesPromise = this.propertyStore
        .fetchProperties()
        .then(() => this.propertyStore.properties);
    }

    let valuesPromise: Promise<IAnnotationPropertyValues> = Promise.resolve({});
    if (this.exportValues) {
      valuesPromise = this.store.propertiesAPI.getPropertyValues(
        this.dataset!.id
      );
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

        downloadToClient({
          href,
          download: this.filename || "upennExport.json"
        });
        this.dialog = false;
      }
    );
  }
}
</script>
