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
                    v-model="deduplicatedName"
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
                    :items="propertyTypeItems"
                    v-model="propertyType"
                    item-text="label"
                    dense
                  ></v-select>
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <layer-select
                    v-if="propertyType === 'layer'"
                    v-model="propertyLayer"
                    label=""
                    :any="false"
                  ></layer-select>
                  <tag-filter-editor
                    v-if="propertyType === 'relational'"
                    v-model="propertyTags"
                    property="true"
                  ></tag-filter-editor>
                  <v-select
                    v-if="propertyType === 'morphology'"
                    :items="shapeItems"
                    label="Shape restriction"
                    v-model="propertyShape"
                    item-text="label"
                  >
                  </v-select>
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
import { IAnnotationProperty, ITagAnnotationFilter } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";

// Popup for new tool configuration
@Component({ components: { LayerSelect, TagFilterEditor } })
export default class PropertyCreation extends Vue {
  readonly store = store;
  readonly propertiesStore = propertiesStore;

  propertyTypeItems = [
    { value: "layer", label: "Intensity property (layer dependant)" },
    { value: "morphology", label: "Morphology property (shape dependant)" },
    { value: "relational", label: "Relational Property (neighbor dependant)" }
  ];

  originalName = "New Property";

  get deduplicatedName() {
    const escapedName = this.originalName.replace(
      /[-\/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );
    const re = new RegExp(`^${escapedName}( \([0-9]*\))?$`);
    const count = this.propertiesStore.properties
      .map((property: IAnnotationProperty) => property.name)
      .map((id: string) => re.test(id))
      .filter((value: boolean) => value).length;
    if (count) {
      return `${this.originalName} (${count})`;
    }
    return this.originalName;
  }

  set deduplicatedName(value) {
    if (
      this.originalName !== this.deduplicatedName &&
      value === this.deduplicatedName
    ) {
      return;
    }
    this.originalName = value;
  }

  propertyType: "layer" | "morphology" | "relational" = "layer";
  dockerImage = "repo/image:tag";

  @Prop()
  readonly open: any;

  propertyLayer: number | null = null;
  propertyTags: ITagAnnotationFilter = {
    tags: [],
    exclusive: false,
    shape: "point",
    enabled: false,
    id: "Relational property tags"
  };
  propertyShape: "point" | "polygon" | "line" | null = null;
  shapeItems: { label: string; value: string | null }[] = [
    {
      label: "Points",
      value: "point"
    },
    { label: "Polygons (blobs)", value: "polygon" },
    { label: "Lines", value: "line" },
    { label: "No restrictions", value: null }
  ];

  createProperty() {
    this.propertiesStore.createProperty({
      id: this.deduplicatedName,
      name: this.deduplicatedName,
      image: this.dockerImage,
      propertyType: this.propertyType,
      layer: this.propertyLayer,
      tags: {
        tags: this.propertyTags.tags,
        exclusive: this.propertyTags.exclusive
      },
      independant: false,
      shape: this.propertyShape,
      customName: null,
      enabled: false,
      computed: false
    });
    this.close();
  }

  @Watch("open")
  reset() {
    this.originalName = "New Property";
    this.dockerImage = "repo/image:tag";
    this.propertyType = "layer";
  }

  close() {
    this.reset();
    this.$emit("done");
  }
}
</script>
