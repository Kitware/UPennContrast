<template>
  <div v-if="toolValues">
    <v-container v-if="basicInternalTemplate.length > 0">
      <template v-for="(item, index) in basicInternalTemplate">
        <tool-configuration-item
          :key="index"
          :item="item"
          :advanced="false"
          @change="changed"
          v-model="toolValues[item.id]"
          :ref="item.id"
        />
      </template>
    </v-container>
    <v-expansion-panels
      v-if="advancedInternalTemplate.length > 0"
      v-model="advancedPanel"
    >
      <v-expansion-panel>
        <v-expansion-panel-header class="title">
          Advanced options
        </v-expansion-panel-header>
        <v-expansion-panel-content eager>
          <v-container>
            <template v-for="(item, index) in advancedInternalTemplate">
              <tool-configuration-item
                :key="index"
                :item="item"
                :advanced="true"
                @change="changed"
                v-model="toolValues[item.id]"
                :ref="item.id"
              />
            </template>
          </v-container>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import ToolConfigurationItem from "@/tools/creation/ToolConfigurationItem.vue";
import AnnotationConfiguration from "@/tools/creation/templates/AnnotationConfiguration.vue";
import TagAndLayerRestriction from "@/tools/creation/templates/TagAndLayerRestriction.vue";
import DockerImage from "@/tools/creation/templates/DockerImage.vue";

@Component({
  components: {
    ToolConfigurationItem
  }
})
// Creates a tool configuration interface based on the current selected template.
export default class ToolConfiguration extends Vue {
  readonly store = store;

  @Prop()
  readonly value!: any;

  advancedPanel: any;

  toolValues: any = null;

  // Dynamic interface elements that depend on various values being selected
  valueTemplates: any = {};

  // All interface elements that should be displayed
  get internalTemplate() {
    return [
      ...(this.template?.interface || []),
      ...Object.entries(this.valueTemplates)
        .map(([, value]: any[]) => value)
        .reduce((arr: any[], interfaceList: any[]) => {
          return [...arr, ...interfaceList];
        }, [])
    ];
  }

  get advancedInternalTemplate() {
    return this.internalTemplate.filter(
      item => item.advanced || item.type === "annotation"
    );
  }

  get basicInternalTemplate() {
    return this.internalTemplate.filter(
      item => !item.advanced || item.type === "annotation"
    );
  }

  @Prop()
  readonly template!: any;

  @Prop()
  readonly defaultValues!: any;

  mounted() {
    this.reset();
  }

  initialize() {
    this.valueTemplates = {};
    // Add default values
    this.setDefaultValues();
    // Add interface elements from current values
    this.updateInterface();
    // Add default values to new elements
    this.setDefaultValues();
  }

  @Watch("template")
  @Watch("defaultValues")
  reset() {
    this.advancedPanel = undefined;
    this.toolValues = this.defaultValues
      ? { ...this.defaultValues }
      : { name: "New Tool", description: "" };
    this.initialize();
    this.changed();
  }

  changed() {
    this.valueTemplates = {};
    this.updateInterface();
    this.setDefaultValues();
    this.$emit("input", { ...this.toolValues });
  }

  @Watch("toolValues")
  updateValues() {
    this.changed();
  }

  setDefaultValues() {
    this.internalTemplate.forEach(item => {
      if (this.toolValues[item.id] !== undefined) {
        return;
      }
      switch (item.type) {
        case "select":
          if (item?.meta?.items.length) {
            const [firstValue] = item.meta.items;
            this.toolValues[item.id] = { ...firstValue };
          }
          break;

        case "radio":
          if (item.values?.length) {
            const [firstValue] = item.values;
            this.toolValues[item.id] = firstValue.value;
          }
          break;

        case "text":
          if (item.meta?.value) {
            this.toolValues[item.id] = item.meta?.value;
          } else if (item.meta?.type === "number") {
            this.toolValues[item.id] = "0.0";
          } else {
            this.toolValues[item.id] = "";
          }
          break;

        case "checkbox":
          if (item.meta?.value) {
            this.toolValues[item.id] = !!item.meta?.value;
          } else {
            this.toolValues[item.id] = false;
          }
          break;

        default:
          // The $refs are referencing child refs
          if (Array.isArray(this.$refs[item.id])) {
            const innerComponents = (this.$refs[item.id] as Vue[]).reduce(
              (innerComponents, configItem) => [
                ...innerComponents,
                configItem.$refs["innerComponent"] as Vue
              ],
              [] as Vue[]
            );
            switch (item.type) {
              case "annotation":
                const annotations = innerComponents as AnnotationConfiguration[];
                if (annotations.length) {
                  this.toolValues[item.id] = {};
                  annotations.forEach(annotation => annotation.reset());
                }
                break;

              case "restrictTagsAndLayer":
                const restricts = innerComponents as TagAndLayerRestriction[];
                if (restricts.length) {
                  this.toolValues[item.id] = {};
                  restricts.forEach(restrict => restrict.reset());
                }
                break;

              case "dockerImage":
                const dockerImages = innerComponents as DockerImage[];
                if (dockerImages.length) {
                  this.toolValues[item.id] = null;
                  dockerImages.forEach(dockerImage => dockerImage.reset());
                }
                break;

              default:
                break;
            }
          }
          break;
      }
    });
  }

  updateInterface() {
    // Go through values to see if additional interface elements need to be added
    Object.entries(this.toolValues).forEach(([key, value]: any[]) => {
      if (value?.meta?.interface) {
        this.valueTemplates = {
          ...this.valueTemplates,
          [key]: value.meta.interface
        };
      }
    });
  }
}
</script>
