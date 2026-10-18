import { shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  store: {
    tools: [] as any[],
    configuration: { propertyIds: [] as string[] },
    editToolsInConfiguration: vi.fn(),
  },
  pipelinesStore: {
    getPipelineById: vi.fn(),
    savePipeline: vi.fn(),
    createStepId: vi.fn(),
    deleteUnreferencedMaterializedProperties: vi.fn(),
  },
  properties: {
    properties: [] as any[],
    workerImageList: { "img/x": {} } as Record<string, any>,
    fetchWorkerImageList: vi.fn(),
  },
}));

vi.mock("@/store", () => ({ default: h.store }));
vi.mock("@/store/pipelines", () => ({
  default: h.pipelinesStore,
  mergeMaterializedPropertyIds: vi.fn(),
}));
vi.mock("@/store/properties", () => ({ default: h.properties }));
vi.mock("@/store/annotation", () => ({
  default: { annotationTags: new Set<string>() },
}));
vi.mock("@/tools/creation/toolFromCatalog", () => ({
  buildDefaultCoordinateAssignments: () => ({
    layer: null,
    Z: { type: "layer", value: 1, max: 1 },
    Time: { type: "layer", value: 1, max: 1 },
  }),
}));
vi.mock("@/components/pipelines/usePipelineRun", () => ({
  PipelineRunControllerKey: Symbol("PipelineRunController"),
  stepStatusColor: () => "",
  stepStatusIcon: () => "",
}));
vi.mock("@/components/DockerImageSelect.vue", () => ({ default: {} }));
vi.mock("@/components/JobLogDialog.vue", () => ({ default: {} }));
vi.mock("@/components/pipelines/PipelineStepEditor.vue", () => ({
  default: {},
}));
vi.mock("@/utils/log", () => ({ logError: vi.fn() }));

import PipelineEditor from "./PipelineEditor.vue";
import { PipelineRunControllerKey } from "@/components/pipelines/usePipelineRun";
import { AnnotationShape, IPipeline } from "@/store/model";

function annotationSetup(tags: string[]): any {
  return {
    tags,
    shape: AnnotationShape.Polygon,
    color: undefined,
    coordinateAssignments: {
      layer: null,
      Z: { type: "layer", value: 1, max: 1 },
      Time: { type: "layer", value: 1, max: 1 },
    },
  };
}

function workerTool(id: string, threshold: number, tags: string[]): any {
  return {
    id,
    name: `Tool ${id}`,
    hotkey: null,
    type: "segmentation",
    template: { name: "t", type: "segmentation", interface: [] },
    values: {
      image: { image: "img/tool" },
      workerInterfaceValues: { threshold },
      annotation: annotationSetup(tags),
    },
  };
}

function linkedAnnotationStep(id: string, toolId: string, threshold = 1): any {
  return {
    id,
    kind: "annotation",
    name: id,
    image: "img/tool",
    workerInterfaceValues: { threshold },
    enabled: true,
    annotation: annotationSetup(["saved"]),
    sourceToolId: toolId,
  };
}

function propertyStep(id: string, extra: any = {}): any {
  return {
    id,
    kind: "property",
    name: id,
    image: "img/prop",
    workerInterfaceValues: {},
    enabled: true,
    shape: AnnotationShape.Polygon,
    inputTags: { tags: ["own"], exclusive: false },
    autoWired: true,
    ...extra,
  };
}

const controller = {
  isRunning: { value: false },
  continueOnError: { value: false },
  canApplyToAllDatasets: { value: false },
  batchDisabledReason: { value: null },
  applyToAllDatasets: { value: false },
  collectionDatasetCount: { value: 0 },
  batchProgress: { value: null },
  runNotice: { value: null },
  isRunningPipeline: () => false,
  canRunPipeline: () => true,
  statusesFor: () => [],
  jobIdFor: () => null,
  run: vi.fn(),
  cancel: vi.fn(),
};

function mountEditor(pipeline: IPipeline) {
  // Persisted, so the editor's dirty baseline is the on-open clone.
  h.pipelinesStore.getPipelineById.mockImplementation((id: string) =>
    id === pipeline.id ? pipeline : null,
  );
  return shallowMount(PipelineEditor, {
    props: { pipeline },
    global: {
      provide: { [PipelineRunControllerKey as symbol]: controller },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.store.tools = [];
  h.properties.properties = [];
  h.store.editToolsInConfiguration.mockResolvedValue(undefined);
  h.pipelinesStore.savePipeline.mockResolvedValue(undefined);
  h.pipelinesStore.createStepId.mockReturnValue("new-step");
});

describe("PipelineEditor linked steps", () => {
  it("refreshes a linked step's saved copy from its tool on open, without marking it dirty", () => {
    h.store.tools = [workerTool("t1", 5, ["from-tool"])];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1", 1)],
    });
    const vm = wrapper.vm as any;

    expect(vm.localPipeline.steps[0].workerInterfaceValues).toEqual({
      threshold: 5,
    });
    expect(vm.localPipeline.steps[0].annotation.tags).toEqual(["from-tool"]);
    expect(vm.isDirty).toBe(false);
    expect(vm.linkStates[0]).toEqual({
      state: "linked",
      sourceKind: "tool",
      sourceName: "Tool t1",
    });
  });

  it("writes an edited linked step back to its tool on save", async () => {
    h.store.tools = [workerTool("t1", 5, ["from-tool"])];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    vm.handleStepUpdate(0, {
      ...vm.localPipeline.steps[0],
      workerInterfaceValues: { threshold: 9 },
    });

    await vm.save();

    expect(h.store.editToolsInConfiguration).toHaveBeenCalledTimes(1);
    const [tools] = h.store.editToolsInConfiguration.mock.calls[0];
    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe("t1");
    expect(tools[0].values.workerInterfaceValues).toEqual({ threshold: 9 });
    expect(h.pipelinesStore.savePipeline).toHaveBeenCalledTimes(1);
  });

  it("does not write an unedited linked step back over a tool changed elsewhere", async () => {
    h.store.tools = [workerTool("t1", 5, ["from-tool"])];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    // The tool is edited elsewhere while the editor is open, and only the
    // pipeline name changes here.
    h.store.tools = [workerTool("t1", 42, ["from-tool"])];
    vm.localPipeline.name = "Renamed";

    await vm.save();

    expect(h.store.editToolsInConfiguration).not.toHaveBeenCalled();
    expect(h.pipelinesStore.savePipeline).toHaveBeenCalledTimes(1);
  });

  it("does not save the pipeline when writing a linked tool back fails", async () => {
    h.store.tools = [workerTool("t1", 5, [])];
    h.store.editToolsInConfiguration.mockRejectedValue(new Error("nope"));
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    vm.handleStepUpdate(0, {
      ...vm.localPipeline.steps[0],
      workerInterfaceValues: { threshold: 9 },
    });

    await vm.save();

    expect(h.pipelinesStore.savePipeline).not.toHaveBeenCalled();
    expect(vm.isDirty).toBe(true);
  });

  it("applies an edit of one linked step to the other steps linked to the same tool", () => {
    h.store.tools = [workerTool("t1", 5, [])];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1"), linkedAnnotationStep("b", "t1")],
    });
    const vm = wrapper.vm as any;

    vm.handleStepUpdate(0, {
      ...vm.localPipeline.steps[0],
      workerInterfaceValues: { threshold: 9 },
    });

    expect(vm.localPipeline.steps[1].workerInterfaceValues).toEqual({
      threshold: 9,
    });
    expect(vm.localPipeline.steps[1].name).toBe("b");
  });

  it("does not auto-wire a step linked to an existing property", () => {
    h.properties.properties = [
      {
        id: "user",
        name: "User property",
        image: "img/prop",
        shape: AnnotationShape.Point,
        tags: { tags: ["own"], exclusive: false },
        workerInterface: {},
      },
    ];
    const upstream = {
      ...linkedAnnotationStep("a", "none"),
      sourceToolId: undefined,
      annotation: annotationSetup(["upstream"]),
    };
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [upstream, propertyStep("p", { sourcePropertyId: "user" })],
    });
    const vm = wrapper.vm as any;

    expect(vm.localPipeline.steps[1].inputTags.tags).toEqual(["own"]);
    expect(vm.localPipeline.steps[1].shape).toBe(AnnotationShape.Point);
  });

  it("adds an existing property as a linked, non-auto-wired step", () => {
    h.properties.properties = [
      {
        id: "user",
        name: "User property",
        image: "img/prop",
        shape: AnnotationShape.Line,
        tags: { tags: ["own"], exclusive: true },
        workerInterface: { radius: 2 },
      },
    ];
    const wrapper = mountEditor({ id: "pipe", name: "P", steps: [] });
    const vm = wrapper.vm as any;

    vm.newStepSource = "existingProperty";
    vm.newStepPropertyId = "user";
    vm.confirmAddStep();

    expect(vm.localPipeline.steps).toEqual([
      expect.objectContaining({
        kind: "property",
        name: "User property",
        image: "img/prop",
        shape: AnnotationShape.Line,
        inputTags: { tags: ["own"], exclusive: true },
        workerInterfaceValues: { radius: 2 },
        autoWired: false,
        sourcePropertyId: "user",
      }),
    ]);
    expect(vm.localPipeline.steps[0]).not.toHaveProperty(
      "materializedPropertyId",
    );
  });

  it("adds an existing tool as a step linked to that tool", () => {
    h.store.tools = [workerTool("t1", 5, ["from-tool"])];
    const wrapper = mountEditor({ id: "pipe", name: "P", steps: [] });
    const vm = wrapper.vm as any;

    vm.newStepSource = "tool";
    vm.newStepToolId = "t1";
    vm.confirmAddStep();

    expect(vm.localPipeline.steps[0]).toMatchObject({
      kind: "annotation",
      sourceToolId: "t1",
      workerInterfaceValues: { threshold: 5 },
    });
  });

  it("does not treat a child re-emitting a linked step with undefined keys as an edit", async () => {
    // As loaded from Girder: JSON has no `color` key.
    const tool = JSON.parse(JSON.stringify(workerTool("t1", 5, ["t"])));
    h.store.tools = [tool];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [JSON.parse(JSON.stringify(linkedAnnotationStep("a", "t1", 5)))],
    });
    const vm = wrapper.vm as any;
    const step = vm.localPipeline.steps[0];
    // What AnnotationConfiguration emits on mount.
    vm.handleStepUpdate(0, {
      ...step,
      annotation: { ...step.annotation, color: undefined },
    });

    expect(vm.isDirty).toBe(false);
    vm.localPipeline.name = "Renamed";
    await vm.save();

    expect(h.store.editToolsInConfiguration).not.toHaveBeenCalled();
  });

  it("keeps a tool change made elsewhere in a field the step did not edit", async () => {
    h.store.tools = [workerTool("t1", 5, ["original"])];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    // The tool's output tags change elsewhere; the step changes a parameter.
    h.store.tools = [workerTool("t1", 5, ["changed-elsewhere"])];
    vm.handleStepUpdate(0, {
      ...vm.localPipeline.steps[0],
      workerInterfaceValues: { threshold: 9 },
    });

    await vm.save();

    const [[written]] = h.store.editToolsInConfiguration.mock.calls[0];
    expect(written.values.workerInterfaceValues).toEqual({ threshold: 9 });
    expect(written.values.annotation.tags).toEqual(["changed-elsewhere"]);
  });

  it("saves what was on screen when Save started and stays unsaved for edits made during it", async () => {
    h.store.tools = [workerTool("t1", 5, [])];
    let finishToolWrite: () => void = () => {};
    h.store.editToolsInConfiguration.mockImplementation(
      () => new Promise<void>((resolve) => (finishToolWrite = resolve)),
    );
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    vm.handleStepUpdate(0, {
      ...vm.localPipeline.steps[0],
      workerInterfaceValues: { threshold: 9 },
    });

    const saving = vm.save();
    vm.localPipeline.name = "Edited during save";
    finishToolWrite();
    await saving;

    expect(h.pipelinesStore.savePipeline.mock.calls[0][0].name).toBe("P");
    expect(vm.isDirty).toBe(true);
  });

  it("gives a step added from an already-linked tool that step's unsaved edits", () => {
    h.store.tools = [workerTool("t1", 1, [])];
    h.pipelinesStore.createStepId.mockReturnValue("b");
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    vm.handleStepUpdate(0, {
      ...vm.localPipeline.steps[0],
      workerInterfaceValues: { threshold: 5 },
    });

    vm.newStepSource = "tool";
    vm.newStepToolId = "t1";
    vm.confirmAddStep();

    expect(vm.localPipeline.steps[1].workerInterfaceValues).toEqual({
      threshold: 5,
    });
  });

  it("compares a step added this session with its tool as it was when added", async () => {
    h.store.tools = [workerTool("t1", 1, ["original"])];
    const wrapper = mountEditor({ id: "pipe", name: "P", steps: [] });
    const vm = wrapper.vm as any;
    vm.newStepSource = "tool";
    vm.newStepToolId = "t1";
    vm.confirmAddStep();
    // The tool changes elsewhere; the new step is not edited.
    h.store.tools = [workerTool("t1", 2, ["changed-elsewhere"])];

    await vm.save();

    expect(h.store.editToolsInConfiguration).not.toHaveBeenCalled();
  });

  it("refreshes a linked step's stored copy to its tool's settings on save", async () => {
    h.store.tools = [workerTool("t1", 5, [])];
    const wrapper = mountEditor({
      id: "pipe",
      name: "P",
      steps: [linkedAnnotationStep("a", "t1")],
    });
    const vm = wrapper.vm as any;
    h.store.tools = [workerTool("t1", 42, [])];
    vm.localPipeline.name = "Renamed";

    await vm.save();

    const [saved] = h.pipelinesStore.savePipeline.mock.calls[0];
    expect(saved.steps[0].workerInterfaceValues).toEqual({ threshold: 42 });
    expect(vm.localPipeline.steps[0].workerInterfaceValues).toEqual({
      threshold: 42,
    });
    expect(vm.isDirty).toBe(false);
  });
});
