import { scaleLinear } from "d3-scale";
import { color as asColor } from "d3-color";
import {
  IDisplayLayer,
  IDataset,
  IDisplaySlice,
  IContrast,
  IImage,
  IDatasetLocation,
} from "./model";
import main from "./index";

const resolveSlice = (slice: IDisplaySlice, value: number) => {
  switch (slice.type) {
    case "constant":
      return slice.value == null ? 0 : slice.value;
    case "offset":
      return value + (slice.value == null ? 0 : slice.value);
    case "max-merge":
      // any value can work, but this value relates to the displayed
      // histogram
      return value;
    default:
      return value;
  }
};

export function getLayerSliceIndexes(
  layer: IDisplayLayer,
  ds: IDataset,
  time: number,
  xy: number,
  z: number,
): { xyIndex: number; zIndex: number; tIndex: number } | null {
  const xyIndex = ds.xy.length > 1 ? resolveSlice(layer.xy, xy) : 0;
  // invalid slices
  if (xyIndex < 0 || xyIndex >= ds.xy.length) {
    return null;
  }
  const zIndex = ds.z.length > 1 ? resolveSlice(layer.z, z) : 0;
  // invalid slices
  if (zIndex < 0 || zIndex >= ds.z.length) {
    return null;
  }
  const tIndex = ds.time.length > 1 ? resolveSlice(layer.time, time) : 0;
  if (tIndex < 0 || tIndex >= ds.time.length) {
    return null;
  }
  return { xyIndex, zIndex, tIndex };
}

export function getLayerImages(
  layer: IDisplayLayer,
  ds: IDataset,
  time: number,
  xy: number,
  z: number,
) {
  const indexes = getLayerSliceIndexes(layer, ds, time, xy, z);
  if (!indexes) {
    return [];
  }
  const { xyIndex, zIndex, tIndex } = indexes;

  return ds.images(
    ds.z[zIndex],
    ds.time[tIndex],
    ds.xy[xyIndex],
    ds.channels[layer.channel],
  );
}

export interface ITileOptionsSimple {
  min: number | "auto" | "min" | "max";
  max: number | "auto" | "min" | "max";
  palette: string[]; // palette of hex colors, e.g. #000000
  frame?: number;
}

export interface ITileOptionsBands {
  bands: { [key: string]: any }[];
  frame?: number;
}

export type ITileOptions = ITileOptionsSimple | ITileOptionsBands;

function palette(color: string, steps: number) {
  const scale = scaleLinear<string>()
    .domain([0, steps - 1])
    .range(["#000000", color]);
  const palette: string[] = [];
  for (let i = 0; i < steps; i++) {
    palette.push(asColor(scale(i))!.hex());
  }
  return palette;
}

export function toStyle(
  color: string,
  contrast: IContrast,
  hist: ITileHistogram | null,
  layer: IDisplayLayer | null,
  ds: IDataset | null,
  image: IImage | null,
): ITileOptions {
  // unless we add a gamma function, 2 steps are all that are necessary.
  const p = palette(color, 2);
  if (contrast.mode === "absolute") {
    return {
      min: contrast.blackPoint,
      max: contrast.whitePoint,
      palette: p,
    };
  }
  let style: ITileOptions = {
    min: "min",
    max: "max",
    palette: p,
  };
  if (hist) {
    const scale = scaleLinear()
      .domain([0, 100])
      .rangeRound([hist.min, hist.max]);
    style = {
      min: scale(contrast.blackPoint),
      max: scale(contrast.whitePoint),
      palette: p,
    };
  }
  if (layer && ds && image) {
    const mmxy = layer.xy.type === "max-merge";
    const mmt = layer.time.type === "max-merge";
    const mmz = layer.z.type === "max-merge";
    if (mmxy || mmt || mmz) {
      const composite: { [key: string]: any }[] = [];
      for (let xyi = 0; xyi < (mmxy ? ds.xy.length : 1); xyi += 1) {
        const xy = mmxy ? ds.xy[xyi] : image.key.xy;
        for (let ti = 0; ti < (mmt ? ds.time.length : 1); ti += 1) {
          const t = mmt ? ds.time[ti] : image.key.t;
          for (let zi = 0; zi < (mmz ? ds.z.length : 1); zi += 1) {
            const z = mmz ? ds.z[zi] : image.key.z;
            composite.push({
              frame: ds.images(z, t, xy, image.key.c)[image.keyOffset]
                .frameIndex,
              min: style.min,
              max: style.max,
              palette: style.palette,
            });
          }
        }
      }
      style = { bands: composite };
    }
  }
  return style;
}

export async function getBandOption(
  dataset: IDataset,
  layer: IDisplayLayer,
  location: IDatasetLocation,
) {
  // Get the images at the location
  const { xy, z, time } = location;
  const indexes = getLayerSliceIndexes(layer, dataset, time, xy, z);
  let images: IImage[] = [];
  if (indexes) {
    const { zIndex, tIndex, xyIndex } = indexes;
    images = dataset.images(zIndex, tIndex, xyIndex, layer.channel);
  }

  // Fetch the histogram
  const histogram = await main.api.getLayerHistogram(images);

  const style = toStyle(
    layer.color,
    layer.contrast,
    histogram,
    layer,
    main.dataset,
    images[0],
  );
  if (images[0]) {
    style.frame = images[0].frameIndex;
  }
  return style;
}

// Returns the style of the layer combined with the frame idx for the current dataset
export async function getCurrentBandOption(layer: IDisplayLayer) {
  const image = (main.getImagesFromLayer(layer)[0] || null) as IImage | null;
  const histogram = await main.getLayerHistogram(layer);
  const style = toStyle(
    layer.color,
    layer.contrast,
    histogram,
    layer,
    main.dataset,
    image,
  );
  if (image) {
    style.frame = image.frameIndex;
  }
  return style;
}

export interface ITileHistogram {
  bin_edges: number[];
  hist: number[];
  max: number;
  min: number;
  samples: number;
}

export function mergeHistograms(histograms: ITileHistogram[]): ITileHistogram {
  if (histograms.length === 0) {
    return {
      hist: [0, 0],
      bin_edges: [0, 0.5],
      min: 0,
      max: 1,
      samples: 0,
    };
  }
  if (histograms.length === 1) {
    return histograms[0];
  }

  // TODO
  return histograms[0];
}
