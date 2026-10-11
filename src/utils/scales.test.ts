import { describe, expect, it } from "vitest";
import {
  isKnownPixelSize,
  normalizeScales,
  pixelSizeFromTileInfo,
  unknownPixelSize,
} from "./scales";
import type { IScales } from "@/store/model";

describe("isKnownPixelSize", () => {
  it("accepts a real calibration", () => {
    expect(isKnownPixelSize({ value: 0.65, unit: "µm" })).toBe(true);
    expect(isKnownPixelSize({ value: 0.00065, unit: "mm" })).toBe(true);
  });

  it("rejects the unknown marker, null, NaN, negatives and missing scales", () => {
    expect(isKnownPixelSize(unknownPixelSize())).toBe(false);
    expect(isKnownPixelSize({ value: null as any, unit: "mm" })).toBe(false);
    expect(isKnownPixelSize({ value: NaN, unit: "mm" })).toBe(false);
    expect(isKnownPixelSize({ value: Infinity, unit: "mm" })).toBe(false);
    expect(isKnownPixelSize({ value: -1, unit: "µm" })).toBe(false);
    expect(isKnownPixelSize(undefined)).toBe(false);
    expect(isKnownPixelSize(null)).toBe(false);
  });

  it("rejects the legacy 1 m placeholder but not 1 of a smaller unit", () => {
    expect(isKnownPixelSize({ value: 1, unit: "m" })).toBe(false);
    expect(isKnownPixelSize({ value: 1, unit: "µm" })).toBe(true);
  });
});

describe("pixelSizeFromTileInfo", () => {
  it("averages two calibrated axes", () => {
    const size = pixelSizeFromTileInfo(0.0002, 0.0004);
    expect(size.unit).toBe("mm");
    expect(size.value).toBeCloseTo(0.0003);
  });

  it("uses the one calibrated axis instead of halving it", () => {
    expect(pixelSizeFromTileInfo(0.0004, null)).toEqual({
      value: 0.0004,
      unit: "mm",
    });
    expect(pixelSizeFromTileInfo(undefined, 0.0004)).toEqual({
      value: 0.0004,
      unit: "mm",
    });
  });

  it("returns the unknown marker, never NaN, for an uncalibrated source", () => {
    expect(pixelSizeFromTileInfo(undefined, undefined)).toEqual(
      unknownPixelSize(),
    );
    expect(pixelSizeFromTileInfo(null, null)).toEqual(unknownPixelSize());
    expect(pixelSizeFromTileInfo(0, 0)).toEqual(unknownPixelSize());
    expect(pixelSizeFromTileInfo(NaN, -1)).toEqual(unknownPixelSize());
  });
});

describe("normalizeScales", () => {
  const rest = {
    zStep: { value: 2, unit: "µm" },
    tStep: { value: 10, unit: "s" },
  } as const;

  it("folds every unknown pixel size into the unknown marker", () => {
    for (const pixelSize of [
      { value: null as any, unit: "mm" },
      { value: 1, unit: "m" },
      { value: 0, unit: "furlong" },
      { value: -2, unit: "µm" },
    ]) {
      expect(
        normalizeScales({ ...rest, pixelSize } as IScales).pixelSize,
      ).toEqual(unknownPixelSize());
    }
  });

  it("returns known scales untouched and leaves other axes alone", () => {
    const scales = { ...rest, pixelSize: { value: 0.65, unit: "µm" } };
    expect(normalizeScales(scales as IScales)).toBe(scales);
    const normalized = normalizeScales({
      ...rest,
      pixelSize: { value: 1, unit: "m" },
    } as IScales);
    expect(normalized.zStep).toEqual(rest.zStep);
  });

  it("keeps the unit of a zero size so the unit selector does not snap back", () => {
    const scales = { ...rest, pixelSize: { value: 0, unit: "µm" } };
    expect(normalizeScales(scales as IScales)).toBe(scales);
  });

  it("does not invent a pixel size for a partial (view) scales object", () => {
    expect(normalizeScales({})).toEqual({});
  });
});
