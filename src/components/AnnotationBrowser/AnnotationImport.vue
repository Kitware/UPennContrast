<template>
  <v-dialog v-model="dialog">
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        v-bind="{ ...attrs, ...$attrs }"
        v-on="on"
        v-description="{
          section: 'Object list actions',
          title: 'Import from JSON',
          description:
            'Import a set of annotations and connections from a JSON file'
        }"
      >
        <v-icon>mdi-import</v-icon>
        Import from JSON
      </v-btn>
    </template>
    <v-card class="pa-2" :disabled="!canImport">
      <v-card-title>
        Import
      </v-card-title>
      <v-card-text class="pt-5 pb-0">
        <v-file-input
          accept="application/JSON"
          prepend-icon="mdi-code-json"
          label="JSON file"
          v-model="jsonFile"
        />
        <v-progress-circular v-if="isLoadingFile" indeterminate />
        <div v-if="isJsonLoaded">
          <div class="pa-2">
            <v-checkbox
              v-model="importAnnotations"
              :label="`Import ${annotations.length} annotations`"
            />
            <v-checkbox
              v-model="importConnections"
              :disabled="!importAnnotations"
              :label="`Import ${connections.length} annotation connections`"
            />
            <v-checkbox
              v-model="importProperties"
              :label="`Import ${properties.length} properties`"
            />
            <v-checkbox
              v-model="importValues"
              :disabled="!importProperties || !importAnnotations"
              :label="
                `Import property values of ${
                  Object.keys(values).length
                } annotations`
              "
            />
          </div>
          <div class="pa-2">
            <v-checkbox
              v-model="overwriteAnnotations"
              :label="
                `Overwrite ${annotationStore.annotations.length} annotations (delete current annotations)`
              "
              @change="overwriteChanged"
            />
            <v-dialog v-model="overwriteDialog" persistent>
              <v-card class="pa-2">
                <v-card-title>
                  Overwrite annotations?
                </v-card-title>
                <v-card-text>
                  This will remove
                  {{ annotationStore.annotations.length }} annotations forever
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn
                    @click="
                      overwriteAnnotations = true;
                      overwriteDialog = false;
                    "
                    color="warning"
                  >
                    Overwrite
                  </v-btn>
                  <v-btn
                    @click="
                      overwriteAnnotations = false;
                      overwriteDialog = false;
                    "
                    color="primary"
                  >
                    Cancel
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </div>
        </div>
      </v-card-text>
      <v-card-actions v-if="isJsonLoaded">
        <v-spacer />
        <v-progress-circular v-if="isImporting" indeterminate />
        <v-btn @click="submit" color="primary">
          Import selection
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertyStore from "@/store/properties";

import {
  IAnnotation,
  IAnnotationBase,
  IAnnotationConnection,
  IAnnotationConnectionBase,
  IAnnotationProperty,
  IAnnotationPropertyValues,
  ISerializedData
} from "@/store/model";

@Component({})
export default class AnnotationImport extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;

  dialog = false;
  overwriteDialog = false;

  jsonFile: File | null = null;
  isLoadingFile = false;
  isJsonLoaded = false;
  isImporting = false;

  annotations: IAnnotation[] = [];
  connections: IAnnotationConnection[] = [];
  properties: IAnnotationProperty[] = [];
  values: IAnnotationPropertyValues = {};

  importAnnotations = true;
  importConnections = true;
  importProperties = true;
  importValues = true;
  overwriteAnnotations = false;

  get canImport() {
    return !!store.dataset;
  }

  @Watch("jsonFile")
  getJsonContent() {
    this.isJsonLoaded = false;
    this.annotations = [];
    this.connections = [];
    this.properties = [];
    this.values = {};
    if (!this.jsonFile) {
      return;
    }
    this.isLoadingFile = true;
    this.jsonFile
      .text()
      .then(jsonText => {
        ({
          annotations: this.annotations,
          annotationConnections: this.connections,
          annotationProperties: this.properties,
          annotationPropertyValues: this.values
        } = JSON.parse(jsonText) as ISerializedData);
        this.isJsonLoaded = true;
      })
      .catch(() => {
        this.jsonFile = null;
      })
      .finally(() => (this.isLoadingFile = false));
  }

  overwriteChanged() {
    if (this.overwriteAnnotations) {
      this.overwriteDialog = true;
    }
  }

  reset() {
    this.dialog = false;
    this.overwriteDialog = false;

    this.jsonFile = null;
    this.isLoadingFile = false;
    this.isJsonLoaded = false;
    this.isImporting = false;

    this.annotations = [];
    this.connections = [];
    this.properties = [];
    this.values = {};

    this.importAnnotations = true;
    this.importConnections = true;
    this.importProperties = true;
    this.importValues = true;
    this.overwriteAnnotations = false;
  }

  async submit() {
    let annotationIdsToRemove: string[] = [];
    if (this.overwriteAnnotations) {
      for (const { id } of annotationStore.annotations) {
        annotationIdsToRemove.push(id);
      }
    }

    // Import annotations
    // promise of: old annotation id -> new annotation
    let allAnnotationsPromise: Promise<Map<
      string,
      IAnnotation
    >> = Promise.resolve(new Map());
    if (this.importAnnotations) {
      const annotationBaseList: IAnnotationBase[] = [];
      for (let arrayIdx = 0; arrayIdx < this.annotations.length; arrayIdx++) {
        const oldAnnotation = this.annotations[arrayIdx];
        annotationBaseList.push({
          tags: oldAnnotation.tags,
          shape: oldAnnotation.shape,
          channel: oldAnnotation.channel,
          location: oldAnnotation.location,
          coordinates: oldAnnotation.coordinates,
          datasetId: this.store.dataset!.id
        });
      }
      allAnnotationsPromise = this.store.annotationsAPI
        .createMultipleAnnotations(annotationBaseList)
        .then(newAnnotations => {
          const oldIdToNewAnnotation: Map<string, IAnnotation> = new Map();
          if (newAnnotations === null) {
            return oldIdToNewAnnotation;
          }
          for (
            let arrayIdx = 0;
            arrayIdx < this.annotations.length;
            arrayIdx++
          ) {
            const oldAnnotation = this.annotations[arrayIdx];
            const newAnnotation = newAnnotations[arrayIdx];
            oldIdToNewAnnotation.set(oldAnnotation.id, newAnnotation);
          }
          return oldIdToNewAnnotation;
        });
    }

    // Import annotation connections
    let allConnectionsPromise: Promise<
      IAnnotationConnection[] | null
    > = Promise.resolve(null);
    if (this.importAnnotations && this.importConnections) {
      // Need all annotations to be sent before sending connections
      allAnnotationsPromise.then(oldIdToNewAnnotation => {
        const annotationConnectionBaseList: IAnnotationConnectionBase[] = [];
        for (const connection of this.connections) {
          const parent = oldIdToNewAnnotation.get(connection.parentId);
          const child = oldIdToNewAnnotation.get(connection.childId);
          if (parent && child) {
            annotationConnectionBaseList.push({
              parentId: parent.id,
              childId: child.id,
              label: connection.label,
              tags: connection.tags,
              datasetId: this.store.dataset!.id
            });
          } else {
            throw "Can't find the parent or the child of the connection to create";
          }
        }
        allConnectionsPromise = this.store.annotationsAPI.createMultipleConnections(
          annotationConnectionBaseList
        );
      });
    }

    // Import properties
    const propertyPromises: Promise<IAnnotationProperty>[] = [];
    const propertyOldIdToIdx: { [oldId: string]: number } = {};
    if (this.importProperties) {
      for (const oldProperty of this.properties) {
        const newPropertyPromise = this.store.propertiesAPI.createProperty(
          oldProperty
        );
        const idx = propertyPromises.push(newPropertyPromise) - 1;
        propertyOldIdToIdx[oldProperty.id] = idx;
      }
    }
    const allPropertiesPromise = Promise.all(propertyPromises);

    // Import annotation values for properties
    const newValueDonePromises: Promise<any>[] = [];
    if (this.importValues && this.importProperties && this.importAnnotations) {
      // Need annotations and properties to be sent before sending values
      Promise.all([allAnnotationsPromise, allPropertiesPromise]).then(
        ([oldIdToNewAnnotation, newProperties]) => {
          for (const oldAnnotationId in this.values) {
            const newAnnotation = oldIdToNewAnnotation.get(oldAnnotationId);
            if (!newAnnotation) {
              throw "Can't find the annotation having the values";
            }
            const oldAnnotationValues = this.values[oldAnnotationId];
            const newAnnotationValues: IAnnotationPropertyValues[0] = {};
            for (const oldPropertyId in oldAnnotationValues) {
              const newProperty =
                newProperties[propertyOldIdToIdx[oldPropertyId]];
              const value = oldAnnotationValues[oldPropertyId];
              newAnnotationValues[newProperty.id] = value;
            }
            const newValueDonePromise = this.store.girderRest.post(
              `annotation_property_values?datasetId=${
                this.store.dataset!.id
              }&annotationId=${newAnnotation.id}`,
              newAnnotationValues
            );
            newValueDonePromises.push(newValueDonePromise);
          }
        }
      );
    }
    const allValuesDonePromise = Promise.all(newValueDonePromises);

    this.isImporting = true;
    Promise.all([
      allAnnotationsPromise,
      allPropertiesPromise,
      allConnectionsPromise,
      allValuesDonePromise
    ])
      .catch(() => {
        // Don't remove annotations
        annotationIdsToRemove.length = 0;
        // Remove imported annotations if possible
        allAnnotationsPromise
          .then(oldIdToNewAnnotation => {
            for (const { id } of oldIdToNewAnnotation.values()) {
              annotationIdsToRemove.push(id);
            }
          })
          .catch();
      })
      .then(() => {
        if (annotationIdsToRemove.length > 0) {
          return this.store.annotationsAPI.deleteMultipleAnnotations(
            annotationIdsToRemove
          );
        }
        return null;
      })
      .then(() => {
        this.annotationStore.fetchAnnotations();
        this.propertyStore.fetchPropertyValues();
      })
      .finally(() => {
        this.reset();
      });
  }
}
</script>
