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
        <div class="pb-4 subtitle-1">
          Using these parameters...
        </div>
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
import toolsStore from "@/store/tool";
import annotationStore from "@/store/annotation";
import {
  IAnnotationProperty,
  AnnotationShape,
  IWorkerLabels,
  AnnotationNames
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
  readonly propertyStore = propertiesStore;
  readonly toolsStore = toolsStore;
  readonly annotationStore = annotationStore;

  availableShapes = toolsStore.availableShapes;

  areTagsExclusive: boolean = false;
  filteringTags: string[] = [];
  filteringShape: AnnotationShape | null = null;

  originalName = "New Property";
  isNameGenerated = true;

  get deduplicatedName() {
    const escapedName = this.originalName.replace(
      /[-\/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );
    const re = new RegExp(`^${escapedName}( \([0-9]*\))?$`);
    const count = this.propertyStore.properties
      .map((property: IAnnotationProperty) => property.name)
      .map((id: string) => re.test(id))
      .filter((value: boolean) => value).length;
    if (count) {
      return `${this.originalName} (${count})`;
    }
    return this.originalName;
  }

  get generatedName() {
    let nameList = [];
    if (this.filteringTags.length) {
      if (this.areTagsExclusive) {
        nameList.push("Exclusive ");
      } else {
        nameList.push("Inclusive ");
      }
      nameList.push("[", this.filteringTags.join(", "), "]");
    } else {
      nameList.push("No tag");
    }
    nameList.push(
      this.filteringShape ? AnnotationNames[this.filteringShape] : "No shape"
    );
    if (this.dockerImage) {
      const imageInterfaceName = this.propertyStore.workerImageList[
        this.dockerImage
      ]?.interfaceName;
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
      !this.propertyStore.workerInterfaces[this.dockerImage]
    ) {
      this.propertyStore.fetchWorkerInterface(this.dockerImage);
    }
  }

  get workerInterface() {
    if (!this.dockerImage) {
      return null;
    }
    const workerInterface = this.propertyStore.workerInterfaces[
      this.dockerImage
    ];
    return workerInterface ? workerInterface : null;
  }

  @Watch("workerInterface")
  workerInterfaceChanged() {
    // TODO: fill the interface and edit DockerImageSelect.vue
  }

  createProperty() {
    if (
      !this.dockerImage ||
      !this.filteringShape ||
      !this.filteringTags.length
    ) {
      return;
    }
    const capturedId = this.deduplicatedName;
    this.propertyStore
      .createProperty({
        id: this.deduplicatedName,
        name: this.deduplicatedName,
        image: this.dockerImage,
        tags: {
          tags: this.filteringTags,
          exclusive: this.areTagsExclusive
        },
        shape: this.filteringShape
      })
      .then(() => {
        this.propertyStore.addAnnotationListId(capturedId);
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
