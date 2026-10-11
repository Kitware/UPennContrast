import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/fetch", () => ({
  fetchAllPages: vi.fn(),
}));

vi.mock("@/store/progress", () => ({
  default: {},
}));

import { getDatasetScales } from "./GirderAPI";
import type { IDataset } from "./model";

function datasetWithTileInfo(tileinfo: any): IDataset {
  return {
    anyImage: () => (tileinfo === undefined ? null : { tileinfo }),
    dimensionLabels: null,
  } as unknown as IDataset;
}

describe("getDatasetScales pixel size", () => {
  it("records the calibrated pixel size in mm", () => {
    expect(
      getDatasetScales(datasetWithTileInfo({ mm_x: 0.0002, mm_y: 0.0002 }))
        .pixelSize,
    ).toEqual({ value: 0.0002, unit: "mm" });
  });

  it("records the unknown marker, not NaN, when mm_x/mm_y are missing", () => {
    // (undefined + undefined) / 2 was NaN, persisted by JSON as null.
    const { pixelSize } = getDatasetScales(datasetWithTileInfo({}));
    expect(pixelSize).toEqual({ value: 0, unit: "mm" });
  });

  it("records the unknown marker when mm_x/mm_y are null", () => {
    expect(
      getDatasetScales(datasetWithTileInfo({ mm_x: null, mm_y: null }))
        .pixelSize,
    ).toEqual({ value: 0, unit: "mm" });
  });

  it("does not halve a size calibrated on one axis", () => {
    expect(
      getDatasetScales(datasetWithTileInfo({ mm_x: 0.0004, mm_y: null }))
        .pixelSize,
    ).toEqual({ value: 0.0004, unit: "mm" });
  });

  it("records the unknown marker, not 1 m, when there is no tile info", () => {
    expect(getDatasetScales(datasetWithTileInfo(undefined)).pixelSize).toEqual({
      value: 0,
      unit: "mm",
    });
  });
});
