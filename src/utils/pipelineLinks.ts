import { cloneDeep, isEqual, isPlainObject } from "lodash";

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

// Equality as persisted: configurations travel as JSON, which drops
// `undefined` keys, so `{ color: undefined }` and `{}` are the same saved
// value. Child editors re-emit with explicit `undefined` keys on mount
// (AnnotationConfiguration always emits `color`), so a plain isEqual would read
// an untouched step as edited.
// Walks the values directly rather than serializing them: the editor's dirty
// check runs this over the whole pipeline on every edit.
export function samePersistedValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    // JSON writes an undefined array element as null.
    return (
      a.length === b.length &&
      a.every((value, index) =>
        samePersistedValue(value ?? null, b[index] ?? null),
      )
    );
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const definedKeys = (value: Record<string, unknown>) =>
      Object.keys(value).filter((key) => value[key] !== undefined);
    const objectA = a as Record<string, unknown>;
    const objectB = b as Record<string, unknown>;
    const keysA = definedKeys(objectA);
    return (
      keysA.length === definedKeys(objectB).length &&
      keysA.every((key) => samePersistedValue(objectA[key], objectB[key]))
    );
  }
  return isEqual(a, b);
}

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

// A worker tool's values as annotation-step fields (the inverse of the
// pipeline runner's buildTransientTool). Null when the tool has no worker
// image. `annotation` falls back to `fallbackAnnotation` for a tool saved
// without one.
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

export function stepPropertyLinkedFields(
  step: IPropertyPipelineStep,
): TPropertyLinkedFields {
  return {
    image: step.image,
    workerInterfaceValues: step.workerInterfaceValues,
    shape: step.shape,
    inputTags: step.inputTags,
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
// the step's saved copy). A property still in `configuredPropertyIds` but not
// loaded yet counts as linked, not deleted, matching the runner (which fails
// such a step rather than materializing a duplicate).
export type TStepLinkState =
  | { state: "unlinked" }
  | { state: "linked"; sourceKind: "tool" | "property"; sourceName: string }
  | { state: "missing"; sourceKind: "tool" | "property" };

export function stepLinkState(
  step: TPipelineStep,
  tools: IToolConfiguration[],
  propertyList: IAnnotationProperty[],
  configuredPropertyIds: string[] = [],
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
  if (property) {
    return {
      state: "linked",
      sourceKind: "property",
      sourceName: property.name,
    };
  }
  return configuredPropertyIds.includes(step.sourcePropertyId)
    ? { state: "linked", sourceKind: "property", sourceName: step.name }
    : { state: "missing", sourceKind: "property" };
}

// The step with its saved copy replaced by its live source's values. Returns
// the step itself (same object) when it is unlinked, its source is gone, or
// the copy already matches, so callers can tell whether anything changed.
export function resolveLinkedStep<T extends TPipelineStep>(
  step: T,
  tools: IToolConfiguration[],
  propertyList: IAnnotationProperty[],
): T;
export function resolveLinkedStep(
  step: TPipelineStep,
  tools: IToolConfiguration[],
  propertyList: IAnnotationProperty[],
): TPipelineStep {
  if (step.kind === "annotation") {
    const tool = findSourceTool(step, tools);
    const fields = tool && toolLinkedFields(tool, step.annotation);
    if (!fields || samePersistedValue(fields, stepToolLinkedFields(step))) {
      return step;
    }
    return { ...step, ...fields };
  }
  const property = findSourceProperty(step, propertyList);
  if (!property) {
    return step;
  }
  const fields = propertyLinkedFields(property);
  return samePersistedValue(fields, stepPropertyLinkedFields(step))
    ? step
    : { ...step, ...fields };
}

// The tool with the edits a linked step made since `baseline` written in, or
// null when it made none. Only changed fields are written, and parameters are
// written one by one, so a change made to the tool elsewhere in a field (or a
// parameter) the step did not touch is kept. The worker image is never
// written: the editor locks it on linked steps (a different worker means a
// different tool, so it requires unlinking).
export function toolWithStepEdits(
  tool: IToolConfiguration,
  step: IAnnotationPipelineStep,
  baseline: TToolLinkedFields,
): IToolConfiguration | null {
  const values = { ...tool.values };
  let changed = false;

  const parameters = { ...(values.workerInterfaceValues ?? {}) };
  const parameterIds = new Set([
    ...Object.keys(step.workerInterfaceValues),
    ...Object.keys(baseline.workerInterfaceValues),
  ]);
  for (const parameterId of parameterIds) {
    const edited = step.workerInterfaceValues[parameterId];
    if (
      samePersistedValue(edited, baseline.workerInterfaceValues[parameterId])
    ) {
      continue;
    }
    if (edited === undefined) {
      delete parameters[parameterId];
    } else {
      parameters[parameterId] = cloneDeep(edited);
    }
    changed = true;
  }
  if (changed) {
    values.workerInterfaceValues = parameters;
  }

  for (const field of ["annotation", "connectTo", "jobDateTag"] as const) {
    if (!samePersistedValue(step[field], baseline[field])) {
      values[field] = cloneDeep(step[field]);
      changed = true;
    }
  }
  return changed ? { ...tool, values } : null;
}
