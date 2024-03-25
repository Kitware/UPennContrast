<template>
  <v-card flat class="pa-0 ma-0">
    <v-card-title v-if="item.name && item.name.length" class="px-4 py-2 ma-0">
      {{ item.name }}
    </v-card-title>
    <v-card-text class="pa-2 ma-0">
      <v-container class="pa-2 pl-6">
        <v-row>
          <v-col :cols="item.type === 'select' ? 6 : 12" class="py-0">
            <!-- Tool configuration component. Type depends on item type. -->
            <component
              :is="typeToComponentName[item.type]"
              :advanced="advanced"
              v-bind="item.meta"
              v-model="componentValue"
              ref="innerComponent"
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

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
// Manually import those vuetify components that might be used procedurally
import { VSelect, VCheckbox, VTextField, VRadioGroup } from "vuetify/lib";
import AnnotationConfiguration from "@/tools/creation/templates/AnnotationConfiguration.vue";
import TagAndLayerRestriction from "@/tools/creation/templates/TagAndLayerRestriction.vue";
import DockerImage from "@/tools/creation/templates/DockerImage.vue";

// Used to determine :is="" value from template interface type
const typeToComponentName = {
  select: "v-select",
  annotation: "annotation-configuration",
  restrictTagsAndLayer: "tag-and-layer-restriction",
  checkbox: "v-checkbox",
  radio: "v-radio-group",
  text: "v-text-field",
  dockerImage: "docker-image",
};

type TComponentType = keyof typeof typeToComponentName;

interface IItem {
  type: TComponentType;
  name?: string;
  meta?: any;
  values?: any;
}

@Component({
  components: {
    AnnotationConfiguration,
    TagAndLayerRestriction,
    VSelect,
    VCheckbox,
    VTextField,
    VRadioGroup,
    DockerImage,
  },
})
// Creates a tool configuration interface based on the current selected template.
export default class ToolConfigurationItem extends Vue {
  readonly store = store;
  readonly typeToComponentName = typeToComponentName;

  @Prop()
  readonly item!: IItem;

  // Pass from custom component to ToolConfiguration
  @Prop()
  readonly value!: any;

  @Prop()
  readonly advanced!: boolean;

  get componentValue() {
    return this.value;
  }

  set componentValue(newValue) {
    this.$emit("input", newValue);
  }

  changed() {
    this.$emit("change");
  }
}
</script>
