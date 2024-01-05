<template>
  <v-card>
    <v-card-text class="pt-0">
      <v-container class="elevation-3 mt-4">
        <div class="pb-4 subtitle-1">
          Create property for annotations matching...
        </div>
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
        <v-row>
          <v-col>
            <v-select
              v-model="filteringShape"
              label="Shape"
              :items="availableShapes"
            />
          </v-col>
        </v-row>
      </v-container>
      <v-container
        class="elevation-3 mt-4"
        v-if="filteringShape !== null && filteringTags.length > 0"
      >
        <div class="pb-4 subtitle-1">Using these parameters...</div>
        <v-row>
          <v-col>
            <docker-image-select
              dense
              v-model="dockerImage"
              :imageFilter="propertyImageFilter"
            />
          </v-col>
        </v-row>
        <template v-if="dockerImage !== null">
          <v-row>
            <v-col>
              <property-worker-menu
                v-model="interfaceValues"
                :image="dockerImage"
              />
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-textarea
                v-model="originalName"
                label="Property name"
                rows="1"
                :append-icon="isNameGenerated ? '' : 'mdi-refresh'"
                @click:append="isNameGenerated = true"
                @input="isNameGenerated = false"
              />
            </v-col>
          </v-row>
        </template>
      </v-container>
      <div class="button-bar">
        <v-spacer></v-spacer>
        <v-btn class="mr-4" color="primary" @click="createProperty">
          SUBMIT
        </v-btn>
        <v-btn class="mr-4" color="warning" @click="reset">CANCEL</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import propertiesStore from "@/store/properties";
import annotationStore from "@/store/annotation";
import {
  AnnotationShape,
  IWorkerLabels,
  AnnotationNames,
  IWorkerInterfaceValues,
} from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";
import DockerImageSelect from "@/components/DockerImageSelect.vue";
import TagPicker from "@/components/TagPicker.vue";
import PropertyWorkerMenu from "@/components/PropertyWorkerMenu.vue";
import { tagFilterFunction } from "@/utils/annotation";

// Popup for new tool configuration
@Component({
  components: {
    LayerSelect,
    TagFilterEditor,
    DockerImageSelect,
    TagPicker,
    PropertyWorkerMenu,
  },
})
export default class PropertyCreation extends Vue {
  readonly store = store;
  readonly propertyStore = propertiesStore;
  readonly annotationStore = annotationStore;

  availableShapes = this.store.availableToolShapes;

  areTagsExclusive: boolean = false;
  filteringTags: string[] = [];
  filteringShape: AnnotationShape | null = null;

  originalName = "New Property";
  isNameGenerated = true;

  interfaceValues: IWorkerInterfaceValues = {};

  get deduplicatedName() {
    // Find a name which is not already taken
    let count = 0;
    let candidateName = this.originalName;
    while (
      this.propertyStore.properties.some(
        (property) => property.name === candidateName,
      )
    ) {
      candidateName = `${this.originalName} (${++count})`;
    }
    return candidateName;
  }

  get generatedName() {
    let nameList = [];
    if (this.filteringTags.length) {
      nameList.push(this.filteringTags.join(", "));
    } else {
      nameList.push("No tag");
    }
    nameList.push(
      this.filteringShape ? AnnotationNames[this.filteringShape] : "No shape",
    );
    if (this.dockerImage) {
      const imageInterfaceName =
        this.propertyStore.workerImageList[this.dockerImage]?.interfaceName;
      if (imageInterfaceName) {
        nameList.push(imageInterfaceName);
      } else {
        nameList.push(this.dockerImage);
      }
    } else {
      nameList.push("No image");
    }
    return nameList.join(" ");
  }

  @Watch("isNameGenerated")
  @Watch("generatedName")
  generatedNameChanged() {
    if (this.isNameGenerated) {
      this.originalName = this.generatedName;
    }
  }

  dockerImage: string | null = null;

  get propertyImageFilter() {
    return (labels: IWorkerLabels) => {
      return (
        labels.isPropertyWorker !== undefined &&
        (labels.annotationShape || null) === this.filteringShape
      );
    };
  }

  @Watch("filteringShape")
  filteringShapeChanged() {
    this.dockerImage = null;
  }

  @Watch("filteringTags")
  filteringTagsChanged() {
    // The keys of counts are in AnnotationShape
    // Find the best matching shape for these tags
    const counts: { [key: string]: number } = {};
    for (const annotation of this.annotationStore.annotations) {
      if (
        tagFilterFunction(
          annotation.tags,
          this.filteringTags,
          this.areTagsExclusive,
        )
      ) {
        if (counts[annotation.shape] === undefined) {
          counts[annotation.shape] = 0;
        }
        ++counts[annotation.shape];
      }
    }
    let bestCount = 0;
    for (const shape in counts) {
      if (counts[shape] !== undefined && counts[shape] > bestCount) {
        bestCount = counts[shape];
        this.filteringShape = shape as AnnotationShape;
      }
    }
  }

  @Watch("dockerImage")
  dockerImageChanged() {
    this.isNameGenerated = true;
    if (
      this.dockerImage &&
      this.propertyStore.workerInterfaces[this.dockerImage] === undefined
    ) {
      this.propertyStore.fetchWorkerInterface({ image: this.dockerImage });
    }
  }

  createProperty() {
    if (
      !this.dockerImage ||
      !this.filteringShape ||
      !this.filteringTags.length
    ) {
      return;
    }
    this.propertyStore
      .createProperty({
        name: this.deduplicatedName,
        image: this.dockerImage,
        tags: {
          tags: this.filteringTags,
          exclusive: this.areTagsExclusive,
        },
        shape: this.filteringShape,
        workerInterface: this.interfaceValues,
      })
      .then((property) => {
        this.propertyStore.togglePropertyPathVisibility([property.id]);
      });
    this.reset();
  }

  reset() {
    this.filteringTags = [];
    this.areTagsExclusive = false;
    this.filteringShape = null;
    this.dockerImage = null;
    this.originalName = "New Property";
    this.isNameGenerated = true;
  }
}
</script>
