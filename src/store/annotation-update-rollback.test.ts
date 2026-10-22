/**
 * Failure rollback of updateAnnotationsPerId's optimistic edits.
 *
 * The action stores each edit before awaiting the save. It used to restore,
 * on failure, the objects it replaced at the indices it captured before the
 * await. Anything that ran during the await made that wrong: a
 * fetchAnnotations rebuilt annotations[] (so the indices pointed at other
 * annotations), or a later edit of the same annotation sat on top of the
 * failed one (and was thrown away, or an earlier failed edit came back).
 *
 * These tests use the REAL store module with the save request held open, so
 * the interleavings are deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { api, mainState } = vi.hoisted(() => ({
  api: {
    updateAnnotations: vi.fn(),
    getAnnotationCount: vi.fn(),
    getAnnotationsForDatasetId: vi.fn(),
    getConnectionsForDatasetId: vi.fn(),
  },
  mainState: {
    isLoggedIn: true,
    dataset: { id: "ds" } as { id: string } | null,
    configuration: {},
  },
}));

vi.mock("./index", () => ({
  default: Object.assign(mainState, { annotationsAPI: api }),
}));
vi.mock("./sync", () => ({
  default: { setSaving: vi.fn() },
}));
vi.mock("./jobs", () => ({
  default: {},
  createProgressEventCallback: () => () => {},
  createErrorEventCallback: () => () => {},
}));
vi.mock("./progress", () => ({
  default: {
    create: vi.fn().mockResolvedValue("progress-1"),
    complete: vi.fn(),
  },
}));
vi.mock("geojs", () => ({
  default: { util: { pointInPolygon: () => false } },
}));
vi.mock("@/tools/creation/templates/AnnotationConfiguration.vue", () => ({}));
vi.mock("@/utils/log", () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

import annotationStore from "./annotation";
import { AnnotationShape, IAnnotation } from "./model";

function makeAnnotation(
  id: string,
  overrides: Partial<IAnnotation> = {},
): IAnnotation {
  return {
    id,
    channel: 0,
    location: { XY: 0, Z: 0, Time: 0 },
    coordinates: [{ x: 0, y: 0 }],
    shape: AnnotationShape.Point,
    tags: [],
    datasetId: "ds",
    name: null,
    color: null,
    ...overrides,
  };
}

// Saves a test left held: settled after each test, so a failing test does
// not leave a save pending that the next test's saves would queue behind.
const heldSaves: { resolve: () => void; reject: (e: Error) => void }[] = [];

// Hold each updateAnnotations call open until the test settles it.
function holdSaves() {
  const saves = heldSaves;
  saves.length = 0;
  api.updateAnnotations.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => saves.push({ resolve, reject })),
  );
  return saves;
}

function rename(id: string, name: string) {
  return annotationStore.updateAnnotationsPerId({
    annotationIds: [id],
    editFunction: (annotation) => {
      annotation.name = name;
    },
  });
}

function recolor(id: string, color: string) {
  return annotationStore.updateAnnotationsPerId({
    annotationIds: [id],
    editFunction: (annotation) => {
      annotation.color = color;
    },
  });
}

// An annotation's saves go out one at a time: wait until the next queued one
// has been sent.
async function sent(saves: unknown[], count: number) {
  await vi.waitFor(() => expect(saves).toHaveLength(count));
}

function stored(id: string) {
  return annotationStore.annotations[annotationStore.annotationIdToIdx[id]];
}

describe("updateAnnotationsPerId failure rollback", () => {
  afterEach(async () => {
    for (const save of heldSaves.splice(0)) {
      save.resolve();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mainState.dataset = { id: "ds" };
    annotationStore.setStubOnlyMode(false);
    annotationStore.setAnnotations([
      makeAnnotation("a", { name: "A" }),
      makeAnnotation("b", { name: "B" }),
    ]);
  });

  it("restores the annotation when its only edit fails", async () => {
    const saves = holdSaves();
    const original = stored("a");
    const pending = rename("a", "renamed");
    expect(stored("a").name).toBe("renamed");

    saves[0].reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");
    expect(stored("a")).toBe(original);
  });

  it("reverts a failed edit in the stubs and hydrated copies the canvas draws from", async () => {
    // With the stub system active, layers render from the stub map and the
    // hydrated map, not annotations[].
    annotationStore.setStubsFromServer([
      {
        id: "a",
        centroid: { x: 0, y: 0 },
        location: { XY: 0, Z: 0, Time: 0 },
        shape: AnnotationShape.Point,
        channel: 0,
        tags: [],
        color: null,
      },
    ]);
    annotationStore.mergeHydratedAnnotations({
      newEntries: [{ id: "a", annotation: stored("a") }],
      touchedIds: [],
    });
    const saves = holdSaves();
    const pending = recolor("a", "#ff0000");
    expect(annotationStore.annotationStubs.get("a")!.color).toBe("#ff0000");
    expect(annotationStore.hydratedAnnotations.get("a")!.color).toBe("#ff0000");

    saves[0].reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");

    expect(annotationStore.annotationStubs.get("a")!.color).toBeNull();
    expect(annotationStore.hydratedAnnotations.get("a")!.color).toBeNull();
  });

  it("does not write over annotations a fetch reloaded during a failed save", async () => {
    const saves = holdSaves();
    const pending = rename("a", "renamed");

    // The server returns the annotations in a different order, so the edit's
    // captured index (0) now holds "b".
    const fetchedB = makeAnnotation("b", { name: "B (server)" });
    const fetchedA = makeAnnotation("a", { name: "A (server)" });
    api.getAnnotationCount.mockResolvedValue(2);
    api.getAnnotationsForDatasetId.mockResolvedValue([fetchedB, fetchedA]);
    api.getConnectionsForDatasetId.mockResolvedValue([]);
    await annotationStore.fetchAnnotations();

    saves[0].reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");

    expect(annotationStore.annotations).toEqual([fetchedB, fetchedA]);
    expect(stored("a")).toBe(fetchedA);
    expect(stored("b")).toBe(fetchedB);
  });

  it("keeps a later edit of the same annotation when an earlier one fails", async () => {
    const saves = holdSaves();
    const first = rename("a", "renamed");
    const second = recolor("a", "#ff0000");

    saves[0].reject(new Error("offline"));
    await expect(first).rejects.toThrow("offline");
    // The recolor is still in flight and may succeed: leave it on screen.
    expect(stored("a").color).toBe("#ff0000");

    await sent(saves, 2);
    saves[1].resolve();
    await second;
    // The server holds the recolor but not the failed rename.
    expect(stored("a").color).toBe("#ff0000");
    expect(stored("a").name).toBe("A");
    expect(stored("b").name).toBe("B");
  });

  it("does not bring back an earlier failed edit when a later one fails too", async () => {
    const saves = holdSaves();
    const original = stored("a");
    const first = rename("a", "renamed");
    const second = recolor("a", "#ff0000");

    saves[0].reject(new Error("offline"));
    await expect(first).rejects.toThrow("offline");
    await sent(saves, 2);
    saves[1].reject(new Error("offline"));
    await expect(second).rejects.toThrow("offline");

    expect(stored("a")).toEqual(original);
  });

  it("sends an annotation's saves one at a time, in order", async () => {
    // Overlapping requests could be applied by the server in another order
    // than their responses arrive; the rollback takes response order as the
    // server's.
    const saves = holdSaves();
    const first = rename("a", "renamed");
    const second = recolor("a", "#ff0000");
    // Another annotation's save is not held back.
    const other = rename("b", "other");

    expect(api.updateAnnotations).toHaveBeenCalledTimes(2);
    expect(api.updateAnnotations.mock.calls[1][0]).toEqual([
      { id: "b", name: "other" },
    ]);
    saves[1].resolve();
    await other;

    saves[0].resolve();
    await first;
    await sent(saves, 3);
    expect(api.updateAnnotations.mock.calls[2][0]).toEqual([
      { id: "a", color: "#ff0000" },
    ]);
    saves[2].reject(new Error("offline"));
    await expect(second).rejects.toThrow("offline");
    // The server holds the rename, not the recolor.
    expect(stored("a").name).toBe("renamed");
    expect(stored("a").color).toBeNull();
  });

  it("keeps an assigned color that matched a failed edit's color", async () => {
    const saves = holdSaves();
    const first = recolor("a", "#ff0000");
    const second = rename("a", "renamed");

    saves[0].reject(new Error("offline"));
    await expect(first).rejects.toThrow("offline");
    // Color-by-property assigns the same red server-side while the rename is
    // pending: nothing changes on screen, but the server now holds it.
    annotationStore.applyColorAssignment([{ color: "#ff0000", ids: ["a"] }]);
    await sent(saves, 2);
    saves[1].resolve();
    await second;

    expect(stored("a").color).toBe("#ff0000");
    expect(stored("a").name).toBe("renamed");
  });

  it("does not restore an annotation deleted during a failed save", async () => {
    const saves = holdSaves();
    const pending = rename("a", "renamed");
    annotationStore.setAnnotations([stored("b")]);

    saves[0].reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");
    expect(annotationStore.annotations.map(({ id }) => id)).toEqual(["b"]);
  });

  it("reverts a failed edit after a color assignment copied it forward", async () => {
    const saves = holdSaves();
    const pending = rename("a", "renamed");
    // Color-by-property writes colors server-side and copies each stored
    // annotation forward with its new color, unsaved rename included.
    annotationStore.applyColorAssignment([{ color: "#0000ff", ids: ["a"] }]);

    saves[0].reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");
    expect(stored("a").name).toBe("A");
    expect(stored("a").color).toBe("#0000ff");
  });

  it("restores the original when an edit listing an id twice fails after an earlier failed edit", async () => {
    const saves = holdSaves();
    const original = stored("a");
    const first = rename("a", "renamed");
    const second = annotationStore.updateAnnotationsPerId({
      annotationIds: ["a", "a"],
      editFunction: (annotation) => {
        annotation.color = "#ff0000";
      },
    });

    saves[0].reject(new Error("offline"));
    await expect(first).rejects.toThrow("offline");
    await sent(saves, 2);
    saves[1].reject(new Error("offline"));
    await expect(second).rejects.toThrow("offline");

    expect(stored("a")).toEqual(original);
  });
});
