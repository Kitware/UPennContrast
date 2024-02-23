<template>
  <v-expansion-panels :value="0">
    <v-expansion-panel v-if="samState && datasetId">
      <v-expansion-panel-header> Options </v-expansion-panel-header>
      <v-expansion-panel-content>
        <v-btn @click="undo" :disabled="prompts.length === 0">
          Undo last prompt
        </v-btn>
        <v-btn @click="redo" :disabled="promptHistory.length === 0">
          Redo last prompt
        </v-btn>
        <v-btn @click="reset" :disabled="prompts.length === 0">
          Reset prompts
        </v-btn>
        <v-btn @click="submit" :disabled="!outputCoordinates">
          Submit annotation
        </v-btn>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import { IToolConfiguration, TSamPrompt } from "@/store/model";
import { NoOutput } from "@/pipelines/computePipeline";

@Component({ components: {} })
export default class SamToolMenu extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;

  @Prop({ required: true })
  readonly tool!: IToolConfiguration;

  // The first element is the oldest
  promptHistory: TSamPrompt[] = [];

  get samState() {
    const state = this.store.selectedTool?.state;
    return state && "pipeline" in state ? state : null;
  }

  get promptNode() {
    return this.samState?.pipeline.promptInputNode ?? null;
  }

  get prompts() {
    const prompts = this.promptNode?.output;
    return prompts && prompts !== NoOutput ? prompts : [];
  }

  set prompts(prompts: TSamPrompt[]) {
    this.promptNode?.setValue(prompts.length === 0 ? NoOutput : prompts);
  }

  get outputCoordinates() {
    return this.samState?.output ?? null;
  }

  undo() {
    const removedPrompt = this.prompts.pop();
    if (!removedPrompt) {
      return;
    }
    this.promptHistory.push(removedPrompt);
    // Update the prompts in the pipeline (call setValue)
    this.prompts = this.prompts;
  }

  redo() {
    const newPrompt = this.promptHistory.pop();
    if (!newPrompt) {
      return;
    }
    this.prompts.push(newPrompt);
    this.prompts = this.prompts;
    // Update the prompts in the pipeline (call setValue)
    this.prompts = this.prompts;
  }

  @Watch("tool")
  reset() {
    this.promptHistory = [];
    this.prompts = [];
  }

  get datasetId() {
    return this.store.dataset?.id ?? null;
  }

  submit() {
    const coordinates = this.outputCoordinates;
    const datasetId = this.datasetId;
    const toolConfiguration = this.tool;
    if (coordinates && datasetId) {
      this.annotationStore.addAnnotationFromTool({
        coordinates,
        datasetId,
        toolConfiguration,
      });
    }
    this.reset();
  }
}
</script>
