<template>
  <v-card>
    <v-card-subtitle class="pa-2"> Menu of: {{ tool.name }} </v-card-subtitle>
    <v-row no-gutters class="pa-2">
      <v-slider
        v-model="radius"
        :thumb-label="true"
        min="1"
        max="100"
        label="Radius"
      />
    </v-row>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import propertiesStore from "@/store/properties";
import { IToolConfiguration } from "@/store/model";
import tool from "@/store/tool";
import { VCard, VCardSubtitle, VRow, VSlider } from "vuetify/lib";
import { Action } from "vuex-module-decorators";
// Popup for new tool configuration
@Component({
  components: {}
})
export default class circleToDotMenu extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  @Prop()
  readonly tool!: IToolConfiguration;

  show: boolean = true;
  radius: number = this.tool.values.radius;

  @Watch("tool")
  toolChanged() {
    this.radius = this.tool.values.radius;
  }

  @Action
  @Watch("radius")
  updateRadius() {
    this.tool.values.radius = this.radius;
  }
}
</script>
