import { cloneDeep, isEqual } from "lodash";

import {
  IAnnotationPipelineStep,
  IAnnotationProperty,
  IAnnotationSetup,
  IPropertyPipelineStep,
  IToolConfiguration,
  TPipelineStep,
} from "@/store/model";

// A step added from an existing tool (sourceToolId) or property
// (sourcePropertyId) is LINKED to it: the source's current values are what run.
// The step's own fields are a saved copy, used only when the source is gone.
// See "Linked steps" in WORKER_PIPELINES.md.

// The fields a linked annotation step takes from its tool.
export type TToolLinkedFields = Pick<
  IAnnotationPipelineStep,
  "image" | "workerInterfaceValues" | "annotation" | "connectTo" | "jobDateTag"
>;

// The fields a linked property step takes from its property.
export type TPropertyLinkedFields = Pick<
  IPropertyPipelineStep,
  "image" | "workerInterfaceValues" | "shape" | "inputTags"
>;

// A worker tool's values as annotation-step fields (the inverse of
// the pipeline runner's buildTransientTool). Null when the tool has no worker image. `annotation`
// falls back to `fallbackAnnotation` for a tool saved without one.
export function toolLinkedFields(
  tool: IToolConfiguration,
  fallbackAnnotation: IAnnotationSetup,
): TToolLinkedFields | null {
  const image = tool.values?.image?.image;
  if (!image) {
    return null;
  }
  return {
    image,
    workerInterfaceValues: cloneDeep(tool.values.workerInterfaceValues ?? {}),
    annotation: tool.values.annotation
      ? cloneDeep(tool.values.annotation)
      : cloneDeep(fallbackAnnotation),
    connectTo: tool.values.connectTo
      ? cloneDeep(tool.values.connectTo)
      : undefined,
    jobDateTag: tool.values.jobDateTag ?? undefined,
  };
}

export function propertyLinkedFields(
  property: IAnnotationProperty,
): TPropertyLinkedFields {
  return {
    image: property.image,
    workerInterfaceValues: cloneDeep(property.workerInterface ?? {}),
    shape: property.shape,
    inputTags: {
      tags: [...property.tags.tags],
      exclusive: property.tags.exclusive,
    },
  };
}

// The step's link fields, for comparing a step against its source or an
// earlier version of itself.
export function stepToolLinkedFields(
  step: IAnnotationPipelineStep,
): TToolLinkedFields {
  return {
    image: step.image,
    workerInterfaceValues: step.workerInterfaceValues,
    annotation: step.annotation,
    connectTo: step.connectTo,
    jobDateTag: step.jobDateTag,
  };
}

export function findSourceTool(
  step: TPipelineStep,
  tools: IToolConfiguration[],
): IToolConfiguration | null {
  if (step.kind !== "annotation" || !step.sourceToolId) {
    return null;
  }
  const tool = tools.find((t) => t.id === step.sourceToolId);
  return tool?.values?.image?.image ? tool : null;
}

export function findSourceProperty(
  step: TPipelineStep,
  propertyList: IAnnotationProperty[],
): IAnnotationProperty | null {
  if (step.kind !== "property" || !step.sourcePropertyId) {
    return null;
  }
  return propertyList.find((p) => p.id === step.sourcePropertyId) ?? null;
}

// How a step relates to a source: not linked, linked to a live source (with
// its name), or linked to a source that no longer exists (the runner then uses
// the step's saved copy).
export type TStepLinkState =
  | { state: "unlinked" }
  | { state: "linked"; sourceKind: "tool" | "property"; sourceName: string }
  | { state: "missing"; sourceKind: "tool" | "property" };

export function stepLinkState(
  step: TPipelineStep,
  tools: IToolConfiguration[],
  propertyList: IAnnotationProperty[],
): TStepLinkState {
  if (step.kind === "annotation") {
    if (!step.sourceToolId) {
      return { state: "unlinked" };
    }
    const tool = findSourceTool(step, tools);
    return tool
      ? { state: "linked", sourceKind: "tool", sourceName: tool.name }
      : { state: "missing", sourceKind: "tool" };
  }
  if (!step.sourcePropertyId) {
    return { state: "unlinked" };
  }
  const property = findSourceProperty(step, propertyList);
  return property
    ? { state: "linked", sourceKind: "property", sourceName: property.name }
    : { state: "missing", sourceKind: "property" };
}

// The step with its saved copy replaced by its live source's values. Returns
// the step itself (same object) when it is unlinked, its source is gone, or
// the copy already matches, so callers can tell whether anything changed.
export function resolveLinkedStep(
  step: TPipelineStep,
  tools: IToolConfiguration[],
  propertyList: IAnnotationProperty[],
): TPipelineStep {
  if (step.kind === "annotation") {
    const tool = findSourceTool(step, tools);
    const fields = tool && toolLinkedFields(tool, step.annotation);
    if (!fields || isEqual(fields, stepToolLinkedFields(step))) {
      return step;
    }
    return { ...step, ...fields };
  }
  const property = findSourceProperty(step, propertyList);
  if (!property) {
    return step;
  }
  const fields = propertyLinkedFields(property);
  const current: TPropertyLinkedFields = {
    image: step.image,
    workerInterfaceValues: step.workerInterfaceValues,
    shape: step.shape,
    inputTags: step.inputTags,
  };
  return isEqual(fields, current) ? step : { ...step, ...fields };
}

// The tool with a linked step's edits written into it. The worker image is
// not written: the editor locks it on linked steps (changing the worker means
// a different tool, so it requires unlinking).
export function toolWithStepEdits(
  tool: IToolConfiguration,
  step: IAnnotationPipelineStep,
): IToolConfiguration {
  return {
    ...tool,
    values: {
      ...tool.values,
      workerInterfaceValues: cloneDeep(step.workerInterfaceValues),
      annotation: cloneDeep(step.annotation),
      connectTo: step.connectTo ? cloneDeep(step.connectTo) : undefined,
      jobDateTag: step.jobDateTag,
    },
  };
}
