import { cloneDeep, isEqual, isPlainObject } from "lodash";

import {
  IAnnotationPipelineStep,
  IAnnotationProperty,
  IAnnotationSetup,
  IPropertyPipelineStep,
  IToolConfiguration,
  IWorkerInterfaceValues,
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
// its name), or linked to a source it can no longer use, in which case the
// runner uses the step's saved copy. An unusable source is either gone or, for
// a tool, still there but without a worker image (`sourceName` is set then).
export type TStepLinkState =
  | { state: "unlinked" }
  | { state: "linked"; sourceKind: "tool" | "property"; sourceName: string }
  | {
      state: "missing";
      sourceKind: "tool" | "property";
      sourceName?: string;
    };

export function stepLinkState(
  step: TPipelineStep,
  tools: IToolConfiguration[],
  propertyList: IAnnotationProperty[],
): TStepLinkState {
  if (step.kind === "annotation") {
    if (!step.sourceToolId) {
      return { state: "unlinked" };
    }
    const tool = tools.find((t) => t.id === step.sourceToolId);
    if (!tool) {
      return { state: "missing", sourceKind: "tool" };
    }
    return findSourceTool(step, tools)
      ? { state: "linked", sourceKind: "tool", sourceName: tool.name }
      : { state: "missing", sourceKind: "tool", sourceName: tool.name };
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

// ---- Pending edits to a linked tool -------------------------------------
// The pipeline editor never edits a copy of a linked tool's values. It shows
// the live tool with the user's pending edits on top, and records only what
// was actually edited: whole fields, except parameters, which are recorded one
// by one. Save writes exactly these onto the tool's current values, so a
// change made to the tool elsewhere is kept unless the user edited the same
// field or parameter here.
export interface IToolEdits {
  workerInterfaceValues?: IWorkerInterfaceValues;
  annotation?: IAnnotationSetup;
  connectTo?: IAnnotationPipelineStep["connectTo"];
  jobDateTag?: boolean;
}

const WHOLE_TOOL_FIELDS = ["annotation", "connectTo", "jobDateTag"] as const;

// What changed between two versions of a linked step's fields.
export function toolEditsBetween(
  before: TToolLinkedFields,
  after: TToolLinkedFields,
): IToolEdits {
  const edits: IToolEdits = {};
  const parameters: IWorkerInterfaceValues = {};
  for (const parameterId in after.workerInterfaceValues) {
    const value = after.workerInterfaceValues[parameterId];
    if (!samePersistedValue(value, before.workerInterfaceValues[parameterId])) {
      parameters[parameterId] = cloneDeep(value);
    }
  }
  if (Object.keys(parameters).length > 0) {
    edits.workerInterfaceValues = parameters;
  }
  for (const field of WHOLE_TOOL_FIELDS) {
    if (!samePersistedValue(after[field], before[field])) {
      Object.assign(edits, { [field]: cloneDeep(after[field]) });
    }
  }
  return edits;
}

export function hasToolEdits(edits: IToolEdits | undefined): boolean {
  return !!edits && Object.keys(edits).length > 0;
}

// `fields` with `edits` applied (later edits win; parameters merge by id).
export function applyToolEdits<T extends TToolLinkedFields | IToolEdits>(
  fields: T,
  edits: IToolEdits | undefined,
): T {
  if (!hasToolEdits(edits)) {
    return fields;
  }
  const { workerInterfaceValues, ...wholeFields } = cloneDeep(edits!);
  return {
    ...fields,
    ...wholeFields,
    ...(workerInterfaceValues
      ? {
          workerInterfaceValues: {
            ...fields.workerInterfaceValues,
            ...workerInterfaceValues,
          },
        }
      : {}),
  };
}

// The edits that still differ from `current` (the live tool's fields, or the
// values just written to it): an edit back to the tool's value is no edit.
export function remainingToolEdits(
  edits: IToolEdits,
  current: TToolLinkedFields | IToolEdits,
): IToolEdits {
  const remaining: IToolEdits = {};
  const parameters: IWorkerInterfaceValues = {};
  for (const parameterId in edits.workerInterfaceValues ?? {}) {
    const value = edits.workerInterfaceValues![parameterId];
    if (
      !samePersistedValue(value, current.workerInterfaceValues?.[parameterId])
    ) {
      parameters[parameterId] = value;
    }
  }
  if (Object.keys(parameters).length > 0) {
    remaining.workerInterfaceValues = parameters;
  }
  for (const field of WHOLE_TOOL_FIELDS) {
    if (field in edits && !samePersistedValue(edits[field], current[field])) {
      Object.assign(remaining, { [field]: edits[field] });
    }
  }
  return remaining;
}

// The tool with pending edits written onto its current values. The worker
// image is never edited: the editor locks it on linked steps (a different
// worker means a different tool, so it requires unlinking).
export function toolWithEdits(
  tool: IToolConfiguration,
  edits: IToolEdits,
): IToolConfiguration {
  const { workerInterfaceValues, ...wholeFields } = cloneDeep(edits);
  return {
    ...tool,
    values: {
      ...tool.values,
      ...wholeFields,
      ...(workerInterfaceValues
        ? {
            workerInterfaceValues: {
              ...(tool.values.workerInterfaceValues ?? {}),
              ...workerInterfaceValues,
            },
          }
        : {}),
    },
  };
}
