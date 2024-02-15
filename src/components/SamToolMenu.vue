<template>
  <v-expansion-panels>
    <v-expansion-panel v-if="samState">
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
        <v-btn @click="submit" :disabled="!currentAnnotation">
          Submit annotation
        </v-btn>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import { IToolConfiguration, TSamPrompt } from "@/store/model";
import { NoOutput } from "@/pipelines/computePipeline";

@Component({ components: {} })
export default class SamToolMenu extends Vue {
  readonly store = store;

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

  get annotationNode() {
    // TODO: add the itk node and the annotation output to the pipeline
    // return this.samState?.pipeline.annotationOutputNode;
    return null;
  }

  get currentAnnotation() {
    // TODO: use annotationNode and do the same thing as for the prompts
    return null;
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

  submit() {
    // TODO: upload annotation
    this.reset();
  }

  mounted() {
    this.reset();
  }
}
</script>
