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
import { describe, it, expect, beforeEach, vi } from "vitest";

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

// Hold each updateAnnotations call open until the test settles it.
function holdSaves() {
  const saves: { resolve: () => void; reject: (e: Error) => void }[] = [];
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

function stored(id: string) {
  return annotationStore.annotations[annotationStore.annotationIdToIdx[id]];
}

describe("updateAnnotationsPerId failure rollback", () => {
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
    saves[1].reject(new Error("offline"));
    await expect(second).rejects.toThrow("offline");

    expect(stored("a")).toEqual(original);
  });

  it("restores what the server holds when saves fail out of order", async () => {
    const saves = holdSaves();
    const first = rename("a", "renamed");
    const second = recolor("a", "#ff0000");

    saves[1].reject(new Error("offline"));
    await expect(second).rejects.toThrow("offline");
    // The rename is still in flight: keep it.
    expect(stored("a").name).toBe("renamed");

    saves[0].resolve();
    await first;
    expect(stored("a").name).toBe("renamed");
    expect(stored("a").color).toBeNull();
  });

  it("does not restore an annotation deleted during a failed save", async () => {
    const saves = holdSaves();
    const pending = rename("a", "renamed");
    annotationStore.setAnnotations([stored("b")]);

    saves[0].reject(new Error("offline"));
    await expect(pending).rejects.toThrow("offline");
    expect(annotationStore.annotations.map(({ id }) => id)).toEqual(["b"]);
  });
});
