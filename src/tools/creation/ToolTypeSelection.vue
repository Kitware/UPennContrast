<template>
  <v-list dense>
    <v-list-item-group v-model="contentType">
      <v-list-item
        v-for="template in templates"
        :key="template.type"
        :value="template.type"
      >
        {{ template.name }}
      </v-list-item>
    </v-list-item-group>
  </v-list>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import toolsStore from "@/store/tool";
import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";

@Component({
  components: {
    ToolConfiguration
  }
})
export default class ToolTypeSelection extends Vue {
  readonly store = toolsStore;

  @Prop()
  private value: any;

  content: any = null;

  get contentType() {
    return this.content?.type;
  }

  set contentType(type) {
    this.content = this.templates.find(template => template.type === type);
  }

  @Watch("content")
  handleChange() {
    this.$emit("input", this.content);
  }

  mounted() {
    if (this.value) {
      this.content = this.value;
    } else {
      this.initialize();
    }
  }

  get templates() {
    return this.store.toolTemplateList;
  }

  @Watch("templates")
  @Watch("value")
  initialize() {
    // Set initial value
    if (!this.value && this.templates.length) {
      this.content = null;
      this.handleChange();
    }
  }
}
</script>
