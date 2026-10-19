import { describe, it, expect } from "vitest";
import {
  examplePlaceholder,
  filterResolvable,
  paletteExamples,
} from "./examples";

const viewer = {
  inViewer: true,
  isLoggedIn: true,
  zCount: 7,
  timeCount: 1,
  layerNames: ["DAPI", "FITC"],
  propertyNames: ["Elongation", "Area"],
};

describe("paletteExamples", () => {
  it("builds viewer examples from the dataset: a real slice, layer and property", () => {
    const examples = paletteExamples(viewer);
    expect(examples).toContain("z 3");
    expect(examples).toContain("show only DAPI");
    expect(examples).toContain("list Area"); // prefers an Area property
    expect(examples).toContain("merge z");
    // One time point: no time example.
    expect(examples.some((e) => e.startsWith("t "))).toBe(false);
  });

  it("omits examples the dataset can't satisfy", () => {
    const examples = paletteExamples({
      ...viewer,
      zCount: 1,
      layerNames: ["DAPI"],
      propertyNames: [],
    });
    expect(
      examples.some((e) => /^z |merge z|show only|list |color by/.test(e)),
    ).toBe(false);
    expect(examples).toContain("objects");
  });

  it("never suggests a slice past the end", () => {
    expect(paletteExamples({ ...viewer, zCount: 2 })).toContain("z 2");
  });

  it("offers upload off the viewer only when logged in", () => {
    const off = { ...viewer, inViewer: false };
    expect(paletteExamples(off)).toContain("upload");
    expect(paletteExamples({ ...off, isLoggedIn: false })).not.toContain(
      "upload",
    );
  });
});

describe("examplePlaceholder", () => {
  it("shows three at a time, wrapping around", () => {
    const examples = ["a", "b", "c", "d"];
    expect(examplePlaceholder(examples, 0)).toBe("Try: a · b · c");
    expect(examplePlaceholder(examples, 3)).toBe("Try: d · a · b");
    expect(examplePlaceholder(["a"], 5)).toBe("Try: a");
  });
});

describe("filterResolvable", () => {
  it("keeps only examples that resolve, and the placeholder survives none", () => {
    expect(
      filterResolvable(["hide objects", "show objects"], (q) =>
        q.startsWith("show"),
      ),
    ).toEqual(["show objects"]);
    expect(examplePlaceholder([], 0)).toBe("Search commands");
  });
});
