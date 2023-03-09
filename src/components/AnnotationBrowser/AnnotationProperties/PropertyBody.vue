<template>
  <v-container>
    <v-row>Image: {{ property.image }}</v-row>
    <v-row>
      Tags ({{ property.tags.exclusive ? "exclusive" : "inclusive" }}):
      {{ property.tags.tags.join(", ") }}
    </v-row>
    <v-row>Shape: {{ annotationNames[property.shape] }}</v-row>
    <v-row>
      Worker interface:
      <v-container class="pl-8">
        <v-row
          v-for="[name, value] in Object.entries(property.workerInterface)"
          :key="name"
        >
          {{ name }}: {{ value }}
        </v-row>
      </v-container>
    </v-row>
    <v-row>
      <v-spacer />
      <v-dialog v-model="deleteDialog">
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            v-bind="attrs"
            v-on="on"
            @click.stop="deleteComputedValues = true"
            color="red"
          >
            Delete property
          </v-btn>
        </template>
        <v-card>
          <v-card-title>
            Delete property
          </v-card-title>
          <v-card-text>
            <v-container>
              <v-row>
                <v-col class="body-2">
                  You are about to delete this property:
                </v-col>
              </v-row>
              <v-row>
                <v-col class="body-1 d-flex justify-center">
                  {{ property.name }}
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-checkbox
                    hide-details
                    dense
                    label="Also delete the computed values for this property"
                    v-model="deleteComputedValues"
                  />
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="red"
              @click="
                () => {
                  deleteProperty();
                  deleteDialog = false;
                }
              "
              >Delete</v-btn
            >
            <v-btn color="primary" @click="deleteDialog = false">Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import propertyStore from "@/store/properties";
import { IAnnotationProperty, AnnotationNames } from "@/store/model";
import { Vue, Component, Prop } from "vue-property-decorator";

@Component({})
export default class AnnotationPropertyBody extends Vue {
  readonly propertyStore = propertyStore;

  @Prop()
  readonly property!: IAnnotationProperty;

  annotationNames = AnnotationNames;

  deleteDialog: boolean = false;
  deleteComputedValues: boolean = false;

  deleteProperty() {
    this.propertyStore.deleteProperty(this.property.id);
    if (this.deleteComputedValues) {
      this.propertyStore.deletePropertyValues(this.property.id);
    }
  }
}
</script>
