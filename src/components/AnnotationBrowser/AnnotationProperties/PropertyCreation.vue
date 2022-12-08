<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Create Property
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row>
          <v-col>
            <tag-picker v-model="filteringTags" />
          </v-col>
          <v-col cols="auto">
            <v-checkbox
              hide-details
              dense
              label="Exclusive"
              v-model="areTagsExclusive"
            />
          </v-col>
        </v-row>
        <template v-if="filteringTags.length">
          <v-row>
            <v-col>
              <v-select
                multiple
                v-model="filteringShapes"
                label="Shape(s)"
                :items="availableShapes"
                dense
              />
            </v-col>
          </v-row>
          <template v-if="filteringShapes.length">
            <v-row>
              <v-col>
                <docker-image-select dense v-model="dockerImage" />
              </v-col>
            </v-row>
          </template>
        </template>
      </v-container>
      <div class="button-bar">
        <v-spacer></v-spacer>
        <v-btn class="mr-4" color="primary" @click="createProperty">
          SUBMIT
        </v-btn>
        <v-btn class="mr-4" color="warning" @click="reset">CANCEL</v-btn>
      </div>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import propertiesStore from "@/store/properties";
import toolsStore from "@/store/tool";
import annotationStore from "@/store/annotation";
import {
  IAnnotationProperty,
  ITagAnnotationFilter,
  AnnotationShape,
  IWorkerInterface
} from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";
import DockerImageSelect from "@/components/DockerImageSelect.vue";
import TagPicker from "@/components/TagPicker.vue";

// Popup for new tool configuration
@Component({
  components: { LayerSelect, TagFilterEditor, DockerImageSelect, TagPicker }
})
export default class PropertyCreation extends Vue {
  readonly store = store;
  readonly propertiesStore = propertiesStore;
  readonly toolsStore = toolsStore;
  readonly annotationStore = annotationStore;

  availableShapes = toolsStore.availableShapes;

  areTagsExclusive: boolean = true;
  filteringTags: string[] = [];
  filteringShapes: AnnotationShape[] = [];

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
  dockerImage: string | null = null;

  propertyLayer: number | null = null;
  propertyTags: ITagAnnotationFilter = {
    tags: [],
    exclusive: false,
    enabled: false,
    id: "Relational property tags"
  };

  @Watch("filteringTags")
  filteringTagsChanged() {
    // The keys of counts are in AnnotationShape
    // Find the best matching shape for these tags
    const counts: { [key: string]: number } = {};
    for (const annotation of this.annotationStore.annotations) {
      if (
        (this.areTagsExclusive &&
          this.filteringTags.every(tag => annotation.tags.includes(tag))) ||
        (!this.areTagsExclusive &&
          this.filteringTags.some(tag => annotation.tags.includes(tag)))
      ) {
        if (counts[annotation.shape] === undefined) {
          counts[annotation.shape] = 0;
        }
        ++counts[annotation.shape];
      }
    }
    this.filteringShapes = [];
    let bestCount = 0;
    for (const shape in counts) {
      if (counts[shape] !== undefined && counts[shape] > bestCount) {
        bestCount = counts[shape];
        this.filteringShapes = [shape as AnnotationShape];
      }
    }
  }

  @Watch("dockerImage")
  dockerImageChanged() {
    if (
      this.dockerImage &&
      !this.propertiesStore.workerInterfaces[this.dockerImage]
    ) {
      this.propertiesStore.fetchWorkerInterface(this.dockerImage);
    }
  }

  get workerInterface() {
    if (!this.dockerImage) {
      return null;
    }
    const workerInterface = this.propertiesStore.workerInterfaces[
      this.dockerImage
    ];
    return workerInterface ? workerInterface : null;
  }

  @Watch("workerInterface")
  workerInterfaceChanged() {
    // TODO: fill the interface and edit DockerImageSelect.vue
  }

  createProperty() {
    if (!this.dockerImage) {
      return;
    }
    for (const shape of this.filteringShapes) {
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
        shape,
        customName: null,
        enabled: false,
        computed: false
      });
    }
    this.reset();
  }

  reset() {
    this.originalName = "New Property";
    this.dockerImage = null;
    this.propertyType = "layer";
  }
}
</script>
