<template>
  <!-- Read only if not advanced because always open -->
  <v-expansion-panel class="pa-0 ma-0" :readonly="!item.advanced">
    <v-expansion-panel-header
      v-if="item.name && item.name.length"
      class="pa-0 ma-0"
    >
      <v-card-title class="py-1 ma-0">{{ item.name }}</v-card-title>
      <!-- Remove icon if not advanced -->
      <template v-if="!item.advanced" v-slot:actions>
        <v-icon />
      </template>
    </v-expansion-panel-header>
    <v-expansion-panel-content class="pa-2 ma-0">
      <v-container class="pa-2 pl-6">
        <v-row>
          <v-col :cols="item.type === 'select' ? 6 : 12" class="py-0">
            <!-- Tool configuration component. Type depends on item type. -->
            <component
              :is="innerComponentName[item.type]"
              v-bind="item.meta"
              :value="value"
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
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
// Manually import those vuetify components that might be used procedurally
import { VSelect, VCheckbox, VTextField, VRadioGroup } from "vuetify/lib";
import AnnotationConfiguration from "@/tools/creation/templates/AnnotationConfiguration.vue";
import TagAndLayerRestriction from "@/tools/creation/templates/TagAndLayerRestriction.vue";
import DockerImage from "@/tools/creation/templates/DockerImage.vue";

@Component({
  components: {
    AnnotationConfiguration,
    TagAndLayerRestriction,
    VSelect,
    VCheckbox,
    VTextField,
    VRadioGroup,
    DockerImage
  }
})
// Creates a tool configuration interface based on the current selected template.
export default class ToolConfigurationItem extends Vue {
  readonly store = store;

  @Prop()
  readonly item!: any;

  // Pass from custom component to ToolConfiguration
  @Prop()
  readonly value!: any;

  // Used to determine :is="" value from template interface type
  innerComponentName: any = {
    select: "v-select",
    annotation: "annotation-configuration",
    restrictTagsAndLayer: "tag-and-layer-restriction",
    checkbox: "v-checkbox",
    radio: "v-radio-group",
    text: "v-text-field",
    dockerImage: "docker-image"
  };

  cardComponentNames = {
    body: "div",
    main: "v-card",
    header: "div",
    content: "v-card-text"
  };

  expansionPanelComponentNames = {
    body: "v-expansion-panels",
    main: "v-expansion-panel",
    header: "v-expansion-panel-header",
    content: "v-expansion-panel-content"
  };

  get wrapperComponentNames() {
    return this.item.advanced
      ? this.expansionPanelComponentNames
      : this.cardComponentNames;
  }

  changed() {
    this.$emit("change");
  }
}
</script>
