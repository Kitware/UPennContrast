<template>
  <v-card>
    <!-- Title and loading -->
    <v-menu
      offset-x
      :closeOnClick="false"
      :closeOnContentClick="false"
      :value="loadingMessages.length > 0"
      z-index="100"
    >
      <template #activator="{}">
        <v-card-title> Options </v-card-title>
      </template>
      <v-card class="d-flex flex-column">
        <v-progress-circular indeterminate />
        <div v-for="(message, i) in loadingMessages" :key="`sam-loading-${i}`">
          {{ message }}
        </div>
      </v-card>
    </v-menu>

    <!-- Main menu -->
    <v-card-text v-if="samState && datasetId">
      <v-checkbox label="Turbo mode" v-model="turboMode" />
      <div v-if="!turboMode">
        <div>
          <v-btn class="my-1" @click="undo" :disabled="prompts.length === 0">
            Undo last prompt
          </v-btn>
          <v-btn
            class="my-1"
            @click="redo"
            :disabled="promptHistory.length === 0"
          >
            Redo last prompt
          </v-btn>
          <v-btn class="my-1" @click="reset" :disabled="prompts.length === 0">
            Reset prompts
          </v-btn>
          <v-btn class="my-1" @click="submit" :disabled="!outputCoordinates">
            Submit annotation
          </v-btn>
        </div>
      </div>
      <v-slider
        class="my-2"
        v-model="simplificationTolerance"
        min="0"
        max="10"
        step="0.01"
        label="Simplification"
      >
        <template v-slot:append>
          <v-text-field
            v-model="simplificationTolerance"
            type="number"
            min="0"
            max="10"
            step="0.01"
            style="width: 60px"
            class="mt-0 pt-0"
          >
          </v-text-field>
        </template>
      </v-slider>
    </v-card-text>

    <!-- Error menu -->
    <v-card-text v-else-if="errorState">
      <v-expansion-panel-content>
        <div class="d-flex">
          <code class="code-block">{{
            errorState.error ? errorState.error.message : "Unknown error"
          }}</code>
        </div>
      </v-expansion-panel-content>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import {
  IToolConfiguration,
  SamAnnotationToolStateSymbol,
  TSamPrompt,
} from "@/store/model";
import { NoOutput } from "@/pipelines/computePipeline";
import { Debounce } from "@/utils/debounce";

@Component({ components: {} })
export default class SamToolMenu extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;

  @Prop({ required: true })
  readonly tool!: IToolConfiguration;

  // The first element is the oldest
  promptHistory: TSamPrompt[] = [];

  turboMode: boolean = true;

  mounted() {
    this.turboMode = this.tool.values.turboMode;
    this.simplificationTolerance = Number(
      this.tool.values.simplificationTolerance,
    );
  }

  @Watch("turboMode")
  @Watch("simplificationTolerance")
  @Debounce(1000, { leading: false, trailing: true })
  toolValuesChanged() {
    const changedValues = {
      turboMode: this.turboMode,
      simplificationTolerance: this.simplificationTolerance,
    };
    const originalValues = this.tool.values;
    let modified = false;
    for (const [key, value] of Object.entries(changedValues)) {
      if (originalValues[key] !== value) {
        modified = true;
        break;
      }
    }
    if (!modified) {
      return;
    }
    console.log("modified");
    console.log(changedValues, originalValues);
    const newToolValues = { ...originalValues, ...changedValues };
    const newTool = {
      ...this.tool,
      values: newToolValues,
    };
    this.store.editToolInConfiguration(newTool);
  }

  get toolState() {
    return this.store.selectedTool?.state;
  }

  get errorState() {
    const state = this.toolState;
    return state && "error" in state ? state : null;
  }

  get samState() {
    const state = this.toolState;
    return state?.type === SamAnnotationToolStateSymbol ? state : null;
  }

  get loadingMessages() {
    return this.samState?.loadingMessages ?? [];
  }

  get simplificationToleranceNode() {
    return this.samState?.nodes.input.simplificationTolerance ?? null;
  }

  get simplificationTolerance() {
    const value = this.simplificationToleranceNode?.output;
    return value == null || value === NoOutput ? -1 : value;
  }

  set simplificationTolerance(tolerance: number) {
    this.simplificationToleranceNode?.setValue(tolerance);
  }

  get promptNode() {
    return this.samState?.nodes.input.mainPrompt ?? null;
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

  @Watch("outputCoordinates")
  onOutputChanged() {
    if (this.turboMode) {
      this.submit();
    }
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
