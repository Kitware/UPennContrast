import {
  unitLengthOptions,
  type IScaleInformation,
  type IScales,
  type TUnitLength,
} from "@/store/model";

// The single representation of "this dataset has no physical pixel size".
// Zero is what the scale bar, Snapshots, the neighborhood dialog, the
// spatial pixel-size adoption and the blob-metrics worker already read as
// unknown, and what the backend's build_scales port records. The old 1 m
// default instead drew a kilometer-long scale bar and fed workers a real
// (absurd) size.
export function unknownPixelSize(): IScaleInformation<TUnitLength> {
  return { value: 0, unit: "mm" };
}

/**
 * Whether a stored pixel size is a real physical calibration. Rejects the
 * unknown marker (0), what an uncalibrated source used to store (null from a
 * NaN), and the legacy 1 m placeholder of configurations created without
 * tile metadata.
 */
export function isKnownPixelSize(
  scale: IScaleInformation<TUnitLength> | null | undefined,
): scale is IScaleInformation<TUnitLength> {
  if (!scale) {
    return false;
  }
  const { value, unit } = scale;
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    !(value === 1 && unit === "m")
  );
}

/**
 * Microscope pixel size from large_image's mm_x/mm_y, or the unknown marker
 * when neither axis is calibrated. An axis that is missing, zero or
 * non-finite is ignored rather than averaged in as 0, which halved the size.
 */
export function pixelSizeFromTileInfo(
  mmX: unknown,
  mmY: unknown,
): IScaleInformation<TUnitLength> {
  const axes = [mmX, mmY].filter(
    (mm): mm is number =>
      typeof mm === "number" && Number.isFinite(mm) && mm > 0,
  );
  if (axes.length === 0) {
    return unknownPixelSize();
  }
  return {
    value: axes.reduce((sum, mm) => sum + mm, 0) / axes.length,
    unit: "mm",
  };
}

/**
 * Scales with every unknown pixel-size representation folded to value 0, so
 * consumers (and the workers they forward scales to) only ever see a real
 * size or 0. A valid stored unit is kept: the scale editor writes {0, "µm"}
 * when the user picks a unit before typing a value, and replacing it would
 * snap the unit selector back. The legacy 1 m placeholder's unit is not a
 * choice anyone made, so it falls back to the default.
 */
export function normalizeScales<T extends Partial<IScales>>(scales: T): T {
  const { pixelSize } = scales;
  const isZeroWithValidUnit =
    pixelSize?.value === 0 && unitLengthOptions.includes(pixelSize.unit);
  if (
    !("pixelSize" in scales) ||
    isZeroWithValidUnit ||
    isKnownPixelSize(pixelSize)
  ) {
    return scales;
  }
  return { ...scales, pixelSize: unknownPixelSize() };
}
