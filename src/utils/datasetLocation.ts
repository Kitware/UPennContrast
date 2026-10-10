import { IDataset, IDatasetLocation } from "@/store/model";
import { clamp } from "@/utils/math";
import { IUnrollFlags } from "@/utils/unroll";

/**
 * Constrain a location index to [0, count - 1]. Non-finite input (a NaN from
 * a malformed `?xy=` query, say) becomes 0, and fractions are truncated.
 */
export function clampLocationIndex(value: number, count: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(Math.trunc(value), 0, Math.max(0, count - 1));
}

/**
 * Constrain a location to the dataset's XY/Z/T dimensions. The store keeps
 * slider indices into `dataset.xy`/`z`/`time`, so an index past the end makes
 * every `dataset.images(...)` lookup at the current location miss.
 *
 * Unrolled axes are left alone: unrolling collapses an axis to one entry, so
 * its count says nothing about the real dimension. Rendering ignores the index
 * of a one-entry axis, and the value there is the frame to return to on
 * roll-up (an unrolled grid cell sets it just before clearing the flag). The
 * reload that rolls the axis up clamps it against the full dimensions.
 */
export function clampLocationToDataset(
  location: IDatasetLocation,
  dataset: Pick<IDataset, "xy" | "z" | "time">,
  unrolled?: IUnrollFlags,
): IDatasetLocation {
  return {
    xy: unrolled?.unrollXY
      ? location.xy
      : clampLocationIndex(location.xy, dataset.xy.length),
    z: unrolled?.unrollZ
      ? location.z
      : clampLocationIndex(location.z, dataset.z.length),
    time: unrolled?.unrollT
      ? location.time
      : clampLocationIndex(location.time, dataset.time.length),
  };
}
