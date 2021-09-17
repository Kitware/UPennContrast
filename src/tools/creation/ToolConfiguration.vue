<template>
  <v-form v-if="internalTemplate && toolValues">
    <template v-for="(item, index) in internalTemplate">
      <v-card :key="index" class="my-1">
        <v-card-title v-if="item.name && item.name.length" class="py-1">
          {{ item.name }}
        </v-card-title>
        <v-card-text class="pa-1">
          <v-container>
            <v-row class="pa-0">
              <v-col :cols="item.type === 'select' ? 6 : 12" class="py-0">
                <component
                  :is="typeToComponentName[item.type]"
                  v-bind="item.meta"
                  v-model="toolValues[item.id]"
                  :ref="item.id"
                  return-object
                  @change="changed"
                  dense
                  small
                >
                  <v-radio
                    v-for="(value, index) in item.values"
                    :key="index"
                    v-bind="value"
                  >
                  </v-radio>
                </component>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
      </v-card>
    </template>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
// Manually import those vuetify components that might be used procedurally
import { VSelect, VCheckbox, VTextField, VRadioGroup } from "vuetify/lib";
import AnnotationConfiguration from "@/tools/creation/templates/AnnotationConfiguration.vue";
import TagAndLayerRestriction from "@/tools/creation/templates/TagAndLayerRestriction.vue";

@Component({
  components: {
    AnnotationConfiguration,
    TagAndLayerRestriction,
    VSelect,
    VCheckbox,
    VTextField,
    VRadioGroup
  }
})
export default class ToolConfiguration extends Vue {
  readonly store = store;

  @Prop()
  readonly value!: any;

  toolValues: any = null;

  typeToComponentName = {
    select: "v-select",
    annotation: "annotation-configuration",
    restrictTagsAndLayer: "tag-and-layer-restriction",
    checkbox: "v-checkbox",
    radio: "v-radio-group",
    text: "v-text-field"
  };

  // dynamic interface elements that depend on various values being selected
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

  @Prop()
  readonly template!: any;

  @Watch("template")
  watchTemplate() {
    this.reset();
  }

  mounted() {
    this.reset();
  }

  initialize() {
    this.valueTemplates = {};
    // Remove values from outdated template
    this.clearUnusedValues();
    // Add default values
    this.setDefaultValues();
    // Add interface elements from current values
    this.updateInterface();
    // Add default values to new elements
    this.setDefaultValues();
  }

  reset() {
    this.toolValues = { name: "New Tool", description: "" };
    this.initialize();
    this.changed();
  }

  changed() {
    this.valueTemplates = {};
    this.updateInterface();
    this.setDefaultValues();
    this.$emit("input", { ...this.toolValues });
  }

  @Watch("toolValues") updateValues() {
    this.changed();
  }

  setDefaultValues() {
    this.internalTemplate.forEach(item => {
      if (this.toolValues[item.id]) {
        return;
      }
      if (item.type === "select") {
        if (item?.meta?.items.length) {
          const [firstValue] = item.meta.items;
          this.toolValues[item.id] = { ...firstValue };
        }
      } else if (item.type === "radio") {
        if (item.values?.length) {
          const [firstValue] = item.values;
          this.toolValues[item.id] = firstValue.value;
        }
      } else if (item.type === "text") {
        if (item.meta?.type === "number") {
          this.toolValues[item.id] = "0.0";
        } else {
          this.toolValues[item.id] = "";
        }
      } else if (this.$refs[item.id]) {
        if (item.type === "annotation") {
          const [annotation] = this.$refs[item.id] as [AnnotationConfiguration];
          if (annotation) {
            this.toolValues[item.id] = {};
            annotation.reset();
          }
        } else if (item.type === "restrictTagsAndLayer") {
          const [restrict] = this.$refs[item.id] as [TagAndLayerRestriction];
          if (restrict) {
            this.toolValues[item.id] = {};
            restrict.reset();
          }
        }
      }
    });
  }

  updateInterface() {
    // Go through values to see if additional interface elements need to be added
    Object.entries(this.toolValues).forEach(([key, value]: any[]) => {
      if (value.meta?.interface) {
        this.valueTemplates = {
          ...this.valueTemplates,
          [key]: value.meta.interface
        };
      }
    });
  }

  clearUnusedValues() {
    // Clear values we can't find the interface for
    Object.keys(this.toolValues).forEach((key: string) => {
      if (
        !this.internalTemplate.find(template => template.id === key) &&
        !["name", "description"].includes(key)
      ) {
        delete this.toolValues[key];
      }
    });
  }
}
</script>
