import { IDisplayLayer, IDataset, IDisplaySlice, IContrast } from "./model";
import { hsl } from "d3-color";
import { scaleLinear } from "d3-scale";

export function getLayerImages(
  layer: IDisplayLayer,
  ds: IDataset,
  time: number,
  z: number
) {
  const resolveSlice = (slice: IDisplaySlice, value: number) => {
    switch (slice.type) {
      case "constant":
        return slice.value!;
      case "offset":
        return value + slice.value!;
      case "max-merge":
        return value; // TODO
      default:
        return value;
    }
  };

  const zIndex = resolveSlice(layer.z, z);
  // invalid slices
  if (zIndex < 0 || zIndex >= ds.z.length) {
    return [];
  }
  const tIndex = resolveSlice(layer.time, time);
  if (tIndex < 0 || tIndex >= ds.time.length) {
    return [];
  }

  return ds.images(ds.time[tIndex], ds.z[zIndex], ds.channels[layer.channel]);
}

export interface ITileOptions {
  min: number | "auto" | "min" | "max";
  max: number | "auto" | "min" | "max";
  palette: string[]; // palette of hex colors, e.g. #000000
}

function palette(color: string, steps: number) {
  const base = hsl(color);
  const palette: string[] = [];
  for (let i = 0; i < steps; i++) {
    const color = hsl(base);
    color.l = i / (steps - 1);
    palette.push(color.hex());
  }
  return palette;
}

export function toStyle(
  color: string,
  contrast: IContrast,
  hist: ITileHistogram | null
): ITileOptions {
  const p = palette(color, 17);
  if (contrast.mode === "absolute") {
    return {
      min: contrast.blackPoint,
      max: contrast.whitePoint,
      palette: p
    };
  }
  if (hist) {
    const scale = scaleLinear()
      .domain([0, 100])
      .range([hist.min, hist.max]);
    return {
      min: scale(contrast.blackPoint),
      max: scale(contrast.whitePoint),
      palette: p
    };
  }
  // cannot compute absolute values yet
  return {
    min: "min",
    max: "max",
    palette: p
  };
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
      samples: 0
    };
  }
  if (histograms.length === 1) {
    return histograms[0];
  }

  // TODO
  return histograms[0];
}
