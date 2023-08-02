import { ITileMeta } from "@/store/GirderAPI";
import {
  IGeoJSOsmLayer,
  IGeoJSQuad,
  IQuadInformation,
  IQuadQuery
} from "@/store/model";

export interface ISetQuadStatusOptions extends IQuadInformation {
  progress: (status: ISetQuadStatus) => void;
  adjustMinLevel?: boolean;
  crossOrigin?: string;
  redrawOnFirstLoad?: boolean;
}

export interface ISetQuadStatus {
  tileinfo: ITileMeta;
  options: ISetQuadStatusOptions;
  images: HTMLImageElement[];
  src: string[];
  quads: (IGeoJSQuad & { image?: HTMLImageElement })[];
  frames: number[];
  framesToIdx: { [frame: number]: number };
  loadedCount: number;
  loaded: boolean;
  frame?: number;
  minLevel?: number;
}

/**
 * Given metadata on a tile source, a GeoJS tileLayer,  and a set of options,
 * add a function to the layer `setFrameQuad(<frame>)` that will, if possible,
 * set the baseQuad to a cropped section of an image that contains excerpts of
 * all frames.
 *
 * @param {object} tileinfo The metadata of the source image.  This expects
 *   ``sizeX`` and ``sizeY`` to be the width and height of the image and
 *   ``frames`` to contain a list of the frames of the image or be undefined if
 *   there is only one frame.
 * @param {geo.tileLayer} layer The GeoJS layer to add the function to.  This
 *   is also used to get a maximal texture size if the layer is a webGL
 *   layer.
 * @param {object} options Additional options for the function. It extends
 *   IQuadInformation which come from ILayerStackImage["baseQuadOptions"]. The
 *   attributes added to this object are described below.
 * @param {number} [options.adjustMinLevel=true] If truthy, adjust the tile
 *   layer's minLevel after the quads are loaded.
 * @param {string} [options.crossOrigin="anonymous"] If specified, use this as the
 *   crossOrigin policy for images.
 * @param {string} [options.progress] If specified, a function to call whenever
 *   a texture image is loaded.
 * @param {boolean} [options.redrawOnFirstLoad=true] If truthy, redraw the
 *   layer after the base quad is first loaded if a frame value has been set.
 */
function setFrameQuad(
  tileinfo: ITileMeta,
  layer: IGeoJSOsmLayer,
  options: ISetQuadStatusOptions
) {
  layer.setFrameQuad = function() {};
  if (
    !tileinfo ||
    !tileinfo.sizeX ||
    !tileinfo.sizeY ||
    !options ||
    !options.baseUrl
  ) {
    return;
  }
  const renderer = layer.renderer();
  const maxTextureSize: number =
    renderer?._maxTextureSize ||
    renderer?.constructor._maxTextureSize ||
    +Infinity;
  options = { ...options, maxTextureSize: Math.min(16384, maxTextureSize) };
  const status: ISetQuadStatus = {
    tileinfo,
    options,
    images: [],
    src: [],
    quads: [],
    frames: [],
    framesToIdx: {},
    loadedCount: 0,
    loaded: false
  };
  loadImages(options, status, layer);
  layer.setFrameQuad = function(frame) {
    const idx = status.framesToIdx[frame];
    if (idx !== undefined && status.loaded) {
      layer.baseQuad = { ...status.quads[idx] };
    }
    status.frame = frame;
  };
  layer.setFrameQuad.status = status;
}

async function loadImages(
  options: ISetQuadStatusOptions,
  status: ISetQuadStatus,
  layer: IGeoJSOsmLayer
) {
  // Helper arrow function to call the progress callback
  const progressFunction = options.progress
    ? () => {
        try {
          options.progress(status);
        } catch {}
      }
    : () => {};

  // Options for the endpoint
  const qiOptions: IQuadQuery = { ...options };
  // Only keep keys that are in IQuadQuery
  // Remove keys which come from IQuadInformation and ISetQuadStatusOptions
  [
    "baseUrl",
    "restRequest",
    "restUrl",

    "progress",
    "adjustMinLevel",
    "crossOrigin",
    "redrawOnFirstLoad"
  ].forEach(k => delete (qiOptions as any)[k]);

  const data = await options.restRequest({
    type: "GET",
    url: `${options.restUrl}/tile_frames/quad_info`,
    data: qiOptions
  });
  status.quads = data.quads;
  status.frames = data.frames;
  status.framesToIdx = data.framesToIdx;

  for (let idx = 0; idx < data.src.length; idx += 1) {
    const img = new Image();
    for (let qidx = 0; qidx < data.quads.length; qidx += 1) {
      if (data.quadsToIdx[qidx] === idx) {
        status.quads[qidx].image = img;
      }
    }
    if (
      options.baseUrl.indexOf(":") >= 0 &&
      options.baseUrl.indexOf("/") === options.baseUrl.indexOf(":") + 1
    ) {
      img.crossOrigin = options.crossOrigin || "anonymous";
    }
    const paramsObj: { [key: string]: number | boolean | string } =
      data.src[idx];
    const params = Object.entries(paramsObj)
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
      .join("&");
    const src = `${options.baseUrl}/tile_frames?` + params;
    status.src.push(src);
    if (idx === data.src.length - 1) {
      img.onload = function() {
        status.loadedCount += 1;
        status.loaded = true;
        if (
          layer._options &&
          layer._options.minLevel !== undefined &&
          (!("adjustMinLevel" in options) || options.adjustMinLevel) &&
          status.minLevel !== undefined &&
          status.minLevel > layer._options.minLevel
        ) {
          const layerMax = layer._options.maxLevel;
          layer._options.minLevel =
            layerMax !== undefined
              ? Math.min(layerMax, status.minLevel)
              : status.minLevel;
        }
        progressFunction();
        if (status.frame !== undefined) {
          layer.baseQuad = {
            ...status.quads[status.framesToIdx[status.frame]]
          };
          if (!("redrawOnFirstLoad" in options) || options.redrawOnFirstLoad) {
            layer.draw();
          }
        }
      };
    } else {
      img.onload = function() {
        status.loadedCount += 1;
        status.images[idx + 1].src = status.src[idx + 1];
        progressFunction();
      };
    }
    status.images.push(img);
  }
  status.images[0].src = status.src[0];
  progressFunction();
  return status;
}

export default setFrameQuad;
