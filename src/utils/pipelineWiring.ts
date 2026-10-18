import { isEqual } from "lodash";

import {
  clampToMaterializablePropertyShape,
  IAnnotationPipelineStep,
  TPipelineStep,
} from "@/store/model";

// Tag auto-wiring (spec: WORKER_PIPELINES.md §5). Shared by the pipeline
// editor (after every edit) and the runner (on the steps as they will run, so
// a linked tool whose output tags changed since the last save still feeds the
// property steps after it).
// Pure function: for every property step that hasn't been manually detached
// (autoWired !== false), pull tags/shape from the nearest preceding enabled
// annotation step. Idempotent, so re-running after every edit is safe.
//
// A step with no `autoWired` flag (saved before the flag existed) is wired too,
// unless `wireUnflagged` is false: the runner passes that, so it never rewires
// a step the user has not seen wired in the editor (its tags may be manual).
export function computeAutoWiredSteps(
  steps: TPipelineStep[],
  { wireUnflagged = true }: { wireUnflagged?: boolean } = {},
): TPipelineStep[] {
  let lastAnnotation: IAnnotationPipelineStep | null = null;
  return steps.map((step) => {
    if (step.kind === "annotation") {
      if (step.enabled) {
        lastAnnotation = step;
      }
      return step;
    }
    // A step linked to an existing property computes on that property's
    // own tags and shape.
    if (
      step.autoWired === false ||
      (step.autoWired === undefined && !wireUnflagged) ||
      step.sourcePropertyId ||
      !lastAnnotation
    ) {
      return step;
    }
    const wiredTags = lastAnnotation.annotation.tags;
    const wiredShape = clampToMaterializablePropertyShape(
      lastAnnotation.annotation.shape,
    );
    if (
      step.shape === wiredShape &&
      step.autoWired === true &&
      isEqual(step.inputTags.tags, wiredTags)
    ) {
      return step;
    }
    return {
      ...step,
      shape: wiredShape,
      inputTags: { ...step.inputTags, tags: [...wiredTags] },
      autoWired: true,
    };
  });
}
