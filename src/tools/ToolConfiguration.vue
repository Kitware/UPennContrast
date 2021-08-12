<template>
  <v-form v-if="internalTemplate">
    <v-card pa-3>
      <v-card-title>General Tool Properties</v-card-title>
      <v-card-text>
        <v-text-field label="Tool Name" v-model="values.name" @change="changed">
        </v-text-field>
        <v-text-field
          label="Tool Description"
          v-model="values.description"
          @change="changed"
        >
          <!-- TODO: hotkeys -->
        </v-text-field>
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
            v-model="values[item.id]"
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
    <div class="button-bar">
      <v-btn color="primary" @click="createTool"> ADD TOOL </v-btn>
    </div>
  </v-form>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
// Manually import those vuetify components that might be used procedurally
import { VSelect, VCheckbox, VTextField, VRadioGroup } from "vuetify/lib";
import AnnotationConfiguration from "@/tools/AnnotationConfiguration.vue";
import TagAndLayerRestriction from "@/tools/TagAndLayerRestriction.vue";

const defaultValues = {
  name: "New Tool",
  description: ""
};

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

  values: any = { ...defaultValues };

  typeToComponentName = {
    select: "v-select",
    annotation: "annotation-configuration",
    restrictTagsAndLayer: "tag-and-layer-restriction",
    checkbox: "v-checkbox",
    radio: "v-radio-group", // TODO: custom component ?
    text: "v-text-field"
  };

  @Prop()
  readonly template!: any;

  // dynamic interface elements that depend on various values being selected
  valueTemplates: any = {};

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

  @Watch("template")
  watchTemplate() {
    this.valueTemplates = {};
    this.values = { ...defaultValues };
  }

  changed() {
    this.valueTemplates = {};
    // Go through values to see if additional interface elements need to be added
    Object.entries(this.values).forEach(([key, value]: any[]) => {
      if (value.meta?.interface) {
        this.valueTemplates = {
          ...this.valueTemplates,
          [key]: value.meta.interface
        };
      }
    });
    // Clear values we can't find the interface for
    Object.keys(this.values).forEach((key: string) => {
      if (
        !this.internalTemplate.find(template => template.id === key) &&
        !["name", "description"].includes(key)
      ) {
        delete this.values[key];
      }
    });
  }

  @Watch("values")
  watchValues() {}

  createTool() {
    // TODO:   Make sure no tool exists with this name
    this.$emit("input", { ...this.values });
    this.$emit("change");
    this.$emit("submit");
  }
}
</script>
