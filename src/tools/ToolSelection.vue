<template>
  <v-select
    v-model="content"
    :items="templates"
    item-text="name"
    item-value="type"
    label="Select a tool type to add"
    return-object
  >
  </v-select>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import ToolConfiguration from "@/tools/ToolConfiguration.vue";

@Component({
  components: {
    ToolConfiguration
  }
})
export default class ToolSelection extends Vue {
  readonly store = store;

  @Prop()
  private value: any;

  content: any = null;

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
      this.content = this.templates[0];
      this.handleChange();
    }
  }
}
</script>
