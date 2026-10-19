import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import propertyStore from "./properties";
import main from "./index";
import store from "./root";
import filters from "./filters";

// Regression tests for the create_property error chain (issue #1239, Codex P2
// on PR #1262).
//
// The AI panel wraps propertyStore.createProperty and reports the failure
// reason to the user. That error crosses FOUR @Action boundaries:
//
//   createProperty -> setProperties -> updateConfigurationProperties
//                                   -> syncConfiguration
//
// vuex-module-decorators replaces a thrown error with a generic
// ERR_ACTION_ACCESS_UNDEFINED message at EVERY boundary that lacks
// { rawError: true }, so all four need it. These tests dispatch the REAL
// actions: the executors test mocks createProperty, which bypasses the
// decorator entirely and cannot catch this.

// `.rejects.toThrow(/regex/)` is a substring match, and the wrapper embeds the
// original error's `.stack` (which contains its message) inside its own
// message -- so a substring assertion passes even when rawError is missing.
// Assert the exact message instead. Same helper as index.test.ts.
async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected the promise to reject, but it resolved");
}

// Which configuration's fetch filled the loaded property list.
function setListConfiguration(configurationId: string | null) {
  (
    propertyStore as unknown as {
      setPropertiesConfigurationId: (id: string | null) => void;
    }
  ).setPropertiesConfigurationId(configurationId);
}

function setLoggedIn(loggedIn: boolean) {
  (store.state as any).main.girderUser = loggedIn ? { _id: "u1" } : null;
}

describe("createProperty propagates the real failure reason", () => {
  beforeEach(() => {
    setLoggedIn(true);
    (main as any).setConfigurationImpl({
      id: "c1",
      data: {
        id: "c1",
        name: "config",
        layers: [],
        tools: [],
        scales: {},
        propertyIds: [],
      } as any,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setListConfiguration(null);
  });

  it("surfaces the backend's message when the property POST fails", async () => {
    vi.spyOn(propertyStore.propertiesAPI, "createProperty").mockRejectedValue(
      new Error("Property name already in use"),
    );

    expect(
      await messageOf(propertyStore.createProperty({ name: "area" } as any)),
    ).toBe("Property name already in use");
  });

  it("surfaces the backend's message when the propertyIds sync fails", async () => {
    // The POST succeeds, then persisting propertyIds to the configuration
    // fails -- the error crosses all four action boundaries.
    vi.spyOn(propertyStore.propertiesAPI, "createProperty").mockResolvedValue({
      id: "p1",
      name: "area",
    } as any);
    vi.spyOn(main.api, "updateConfigurationKey").mockRejectedValue(
      new Error("Read-only collection"),
    );

    expect(
      await messageOf(propertyStore.createProperty({ name: "area" } as any)),
    ).toBe("Read-only collection");
  });

  it("rolls the property list back when the sync fails", async () => {
    const before = propertyStore.properties.length;
    vi.spyOn(propertyStore.propertiesAPI, "createProperty").mockResolvedValue({
      id: "p1",
      name: "area",
    } as any);
    vi.spyOn(main.api, "updateConfigurationKey").mockRejectedValue(
      new Error("Read-only collection"),
    );

    await messageOf(propertyStore.createProperty({ name: "area" } as any));
    expect(propertyStore.properties.length).toBe(before);
  });

  it("registers nothing when another configuration opens during the create request", async () => {
    // The previous configuration's list is still loaded when the request
    // returns (the new one's fetch lands later).
    (
      propertyStore as unknown as {
        setPropertiesImpl: (properties: { id: string; name: string }[]) => void;
      }
    ).setPropertiesImpl([{ id: "from-c1", name: "Area" }]);
    vi.spyOn(propertyStore.propertiesAPI, "createProperty").mockImplementation(
      async () => {
        (main as any).setConfigurationImpl({
          id: "c2",
          data: {
            id: "c2",
            name: "other",
            layers: [],
            tools: [],
            scales: {},
            propertyIds: ["from-c2"],
          } as any,
        });
        return { id: "p1", name: "area" } as any;
      },
    );
    const sync = vi
      .spyOn(main.api, "updateConfigurationKey")
      .mockResolvedValue({} as any);

    expect(
      await messageOf(propertyStore.createProperty({ name: "area" } as any)),
    ).toContain("Another configuration was opened");
    // c1's list is not saved as c2's propertyIds.
    expect(sync).not.toHaveBeenCalled();
    expect(main.configuration!.propertyIds).toEqual(["from-c2"]);
    expect(propertyStore.properties.map((p) => p.id)).toEqual(["from-c1"]);
  });

  it("refuses to save a property list loaded for another configuration", async () => {
    // c1's list is loaded, then c2 opens and its fetch has not landed yet.
    (
      propertyStore as unknown as {
        setPropertiesImpl: (properties: { id: string; name: string }[]) => void;
      }
    ).setPropertiesImpl([{ id: "from-c1", name: "Area" }]);
    setListConfiguration("c1");
    (main as any).setConfigurationImpl({
      id: "c2",
      data: {
        id: "c2",
        name: "other",
        layers: [],
        tools: [],
        scales: {},
        propertyIds: ["from-c2"],
      } as any,
    });
    const sync = vi
      .spyOn(main.api, "updateConfigurationKey")
      .mockResolvedValue({} as any);

    expect(await messageOf(propertyStore.deleteProperty("from-c1"))).toContain(
      "Another configuration was opened",
    );
    expect(sync).not.toHaveBeenCalled();
    expect(main.configuration!.propertyIds).toEqual(["from-c2"]);
  });

  it("saves a property list loaded for the loaded configuration", async () => {
    (
      propertyStore as unknown as {
        setPropertiesImpl: (properties: { id: string; name: string }[]) => void;
      }
    ).setPropertiesImpl([
      { id: "p1", name: "Area" },
      { id: "p2", name: "Perimeter" },
    ]);
    setListConfiguration("c1");
    const sync = vi
      .spyOn(main.api, "updateConfigurationKey")
      .mockResolvedValue({} as any);

    await propertyStore.deleteProperty("p1");

    expect(sync).toHaveBeenCalledTimes(1);
    expect(main.configuration!.propertyIds).toEqual(["p2"]);
  });

  it("does not reconcile another configuration's plots after a switch during the save", async () => {
    (
      propertyStore as unknown as {
        setPropertiesImpl: (properties: { id: string; name: string }[]) => void;
      }
    ).setPropertiesImpl([{ id: "p1", name: "Area" }]);
    setListConfiguration("c1");
    vi.spyOn(main.api, "updateConfigurationKey").mockImplementation(
      async () => {
        (main as any).setConfigurationImpl({
          id: "c2",
          data: { id: "c2", propertyIds: [] } as any,
        });
        return {} as any;
      },
    );
    const reconcile = vi.spyOn(filters, "reconcileAnalysisPlotsForPropertyIds");

    await propertyStore.deleteProperty("p1");

    expect(reconcile).not.toHaveBeenCalled();
  });

  it("reconciles plots immediately after deleting an attached property", async () => {
    (
      propertyStore as unknown as {
        setPropertiesImpl: (properties: { id: string; name: string }[]) => void;
      }
    ).setPropertiesImpl([
      { id: "deleted", name: "Deleted" },
      { id: "kept", name: "Kept" },
    ]);
    const gate = {
      categoryKeyVersion: 1 as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      xCategories: null,
      yCategories: null,
    };
    filters.hydrateAnalysisPlots([
      {
        id: "p1",
        xAxis: { type: "property", path: ["deleted", "Area"] },
        yAxis: { type: "categorical", key: "tags" },
        gate,
        gateEnabled: true,
      },
      {
        id: "p2",
        xAxis: { type: "property", path: ["kept", "Area"] },
        yAxis: { type: "categorical", key: "shape" },
        gate,
        gateEnabled: true,
      },
    ]);
    filters.setAnalysisGateIds({ p1: ["a"], p2: ["a"] });
    vi.spyOn(main.api, "updateConfigurationKey").mockResolvedValue({} as any);
    vi.spyOn(main, "scheduleAnnotationBrowserSave").mockImplementation(
      () => undefined,
    );

    await propertyStore.deleteProperty("deleted");

    expect(filters.analysisPlots[0].xAxis).toBeNull();
    expect(filters.analysisPlots[0].gate).toBeNull();
    expect(filters.analysisGateIds).toEqual({});
  });

  it("surfaces the backend's message when deleting a propertyIds sync fails", async () => {
    (
      propertyStore as unknown as {
        setPropertiesImpl: (properties: { id: string; name: string }[]) => void;
      }
    ).setPropertiesImpl([{ id: "p1", name: "Area" }]);
    vi.spyOn(main.api, "updateConfigurationKey").mockRejectedValue(
      new Error("Read-only collection"),
    );

    expect(await messageOf(propertyStore.deleteProperty("p1"))).toBe(
      "Read-only collection",
    );
  });
});

describe("adoptServerRegisteredProperty", () => {
  it("adds a server-registered id locally, once, without a write", async () => {
    (main as any).setConfigurationImpl({
      id: "c1",
      data: {
        id: "c1",
        name: "config",
        layers: [],
        tools: [],
        scales: {},
        propertyIds: ["a"],
      } as any,
    });
    const sync = vi.spyOn(main.api, "updateConfigurationKey");
    await propertyStore.adoptServerRegisteredProperty("b");
    await propertyStore.adoptServerRegisteredProperty("b");
    expect(main.configuration!.propertyIds).toEqual(["a", "b"]);
    expect(sync).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
