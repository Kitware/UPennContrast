<template>
  <div>
    <v-card class="pa-1">
      <v-card-title>
        Create a new property
      </v-card-title>
      <v-card-text class="pa-1">
        <v-card>
          <v-card-text class="pa-1">
            <v-container>
              <v-row>
                <v-col>
                  <v-text-field
                    label="Property Name"
                    v-model="propertyName"
                    dense
                  >
                  </v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-text-field
                    label="Docker image"
                    dense
                    v-model="dockerImage"
                  ></v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-select
                    :items="propertyTypes"
                    v-model="propertyType"
                    dense
                  ></v-select>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>
        </v-card>
      </v-card-text>
      <v-card-actions>
        <div class="button-bar">
          <v-spacer></v-spacer>
          <v-btn class="mr-4" color="primary" @click="createProperty">
            SUBMIT
          </v-btn>
          <v-btn class="mr-4" color="warning" @click="close">CANCEL</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import propertiesStore from "@/store/properties";

// Popup for new tool configuration
@Component({})
export default class ToolCreation extends Vue {
  readonly store = store;
  readonly propertiesStore = propertiesStore;

  propertyTypes = ["layer", "morphology", "relational"];

  propertyName = "New Property";
  propertyType: "layer" | "morphology" | "relational" = "layer";
  dockerImage = "repo/image:tag";

  @Prop()
  readonly open: any;

  createProperty() {
    // call api with new property
    // check response. if it has an id, success
    // report failure
    this.propertiesStore.createProperty({
      name: this.propertyName,
      image: this.dockerImage,
      type: this.propertyType
    });
    this.close();
  }

  @Watch("open")
  reset() {
    this.propertyName = "New Property";
    this.dockerImage = "repo/image:tag";
    this.propertyType = "layer";
  }

  close() {
    this.reset();
    this.$emit("done");
  }
}
</script>
