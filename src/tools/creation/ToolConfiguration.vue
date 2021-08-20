<template>
  <v-form v-if="internalTemplate && toolValues">
    <v-card pa-3>
      <v-card-title>General Tool Properties</v-card-title>
      <v-card-text>
        <v-text-field
          label="Tool Name"
          v-model="toolValues.name"
          @change="changed"
        >
        </v-text-field>
        <v-textarea
          label="Tool Description"
          v-model="toolValues.description"
          @change="changed"
        >
        </v-textarea>
      </v-card-text>
    </v-card>
    <template v-for="(item, index) in internalTemplate">
      <v-card :key="index" class="my-3">
        <v-card-title>
          {{ item.name }}
        </v-card-title>
        <v-card-text>
          <!-- <v-radio-group v-else-if="item.type === 'radio'">
            <v-radio v-for="(value, index) in item.values" :key="index">
              {{ value }}
            </v-radio>
          </v-radio-group> -->
          <component
            :is="typeToComponentName[item.type]"
            v-bind="item.meta"
            v-model="toolValues[item.id]"
            return-object
            @change="changed"
          >
            <v-radio
              v-for="(value, index) in item.values"
              :key="index"
              v-bind="value"
            >
            </v-radio>
          </component>
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
    this.$emit("reset");
    this.initialize();
  }

  @Watch("value")
  watchValue() {
    this.initialize();
  }

  mounted() {
    this.initialize();
  }

  //
  initialize() {
    this.toolValues = { ...this.value };
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

  changed() {
    this.valueTemplates = {};
    this.updateInterface();
    this.$emit("input", { ...this.toolValues });
  }
}
</script>