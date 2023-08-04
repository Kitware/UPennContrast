import { ITileMeta } from "@/store/GirderAPI";
import { IGeoJSOsmLayer, IGeoJSQuad, IQuadInformation } from "@/store/model";

export interface ISetQuadStatusOptions {
  progress: (status: ISetQuadStatus) => void;
  adjustMinLevel: boolean;
  crossOrigin: string;
  redrawOnFirstLoad: boolean;
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
  totalToLoad: number;
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
 * @param {object} quadInformation Informations from
 *   ILayerStackImage["baseQuadOptions"]
 * @param {object} partialOptions Additional options for the function.
 * @param {number} [partialOptions.adjustMinLevel=true] If truthy, adjust the
 *   tile layer's minLevel after the quads are loaded.
 * @param {string} [partialOptions.crossOrigin="anonymous"] If specified, use
 *   this as the crossOrigin policy for images.
 * @param {string} [partialOptions.progress] If specified, a function to call
 *   whenever a texture image is loaded.
 * @param {boolean} [partialOptions.redrawOnFirstLoad=true] If truthy, redraw
 *   the layer after the base quad is first loaded if a frame value has been
 *   set.
 */
export default function setFrameQuad(
  tileinfo: ITileMeta,
  layer: IGeoJSOsmLayer,
  quadInformation: IQuadInformation,
  partialOptions: Partial<ISetQuadStatusOptions>
) {
  if (!tileinfo || !tileinfo.sizeX || !tileinfo.sizeY) {
    return;
  }
  // Recompute maxTextureSize in quadInformation.queryParameters
  const renderer = layer.renderer();
  const maxTextureSize = Math.min(
    ...([
      16384,
      quadInformation.queryParameters.maxTextureSize,
      renderer?._maxTextureSize,
      renderer?.constructor._maxTextureSize
    ].filter(x => x !== undefined) as number[])
  );
  const maxTexQuadInformation: IQuadInformation = {
    ...quadInformation,
    queryParameters: { ...quadInformation.queryParameters, maxTextureSize }
  };
  // Default options
  const options: ISetQuadStatusOptions = {
    progress: () => {},
    adjustMinLevel: true,
    crossOrigin: "anonymous",
    redrawOnFirstLoad: true,
    ...partialOptions
  };
  const status: ISetQuadStatus = {
    tileinfo,
    options,
    images: [],
    src: [],
    quads: [],
    frames: [],
    framesToIdx: {},
    loadedCount: 0,
    totalToLoad: 0,
    loaded: false
  };
  layer.setFrameQuad = function(frame) {
    const idx = status.framesToIdx[frame];
    if (idx !== undefined && status.loaded) {
      layer.baseQuad = { ...status.quads[idx] };
    }
    status.frame = frame;
  };
  layer.setFrameQuad.status = status;
  loadImages(options, maxTexQuadInformation, status, layer);
}

async function loadImages(
  options: ISetQuadStatusOptions,
  quadInformation: IQuadInformation,
  status: ISetQuadStatus,
  layer: IGeoJSOsmLayer
) {
  // Helper arrow function to call the progress callback
  const safeProgress = () => {
    try {
      options.progress(status);
    } catch {}
  };

  // Get quad info and update status
  const data = await quadInformation.restRequest({
    type: "GET",
    url: `${quadInformation.restUrl}/tile_frames/quad_info`,
    data: quadInformation.queryParameters
  });
  status.quads = data.quads;
  status.frames = data.frames;
  status.framesToIdx = data.framesToIdx;
  status.totalToLoad = data.src.length;
  safeProgress();

  // Create an Image element for each src in the quad info
  for (let idx = 0; idx < data.src.length; idx++) {
    const img = new Image();

    // Set the created image in images array and quads array
    status.images[idx] = img;
    for (let qidx = 0; qidx < data.quads.length; qidx += 1) {
      if (data.quadsToIdx[qidx] === idx) {
        status.quads[qidx].image = img;
      }
    }

    // Cross origin option
    if (
      quadInformation.baseUrl.indexOf(":") >= 0 &&
      quadInformation.baseUrl.indexOf("/") ===
        quadInformation.baseUrl.indexOf(":") + 1
    ) {
      img.crossOrigin = options.crossOrigin;
    }

    // Compute the src and set the img's src
    const paramsObj: { [key: string]: number | boolean | string } =
      data.src[idx];
    const params = Object.entries(paramsObj)
      .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
      .join("&");
    const src = `${quadInformation.baseUrl}/tile_frames?` + params;
    status.src[idx] = src;
    img.src = src;

    // Wait for the image to load
    await new Promise<void>(resolve => {
      const voidResolve = () => resolve();
      img.onload = voidResolve;
      img.onerror = voidResolve;
    });
    status.loadedCount += 1;
    safeProgress();
  }

  // Done loading all images
  status.loaded = true;
  safeProgress();

  // Adjust min level of the layer
  if (
    options.adjustMinLevel &&
    layer._options?.minLevel !== undefined &&
    status.minLevel !== undefined &&
    status.minLevel > layer._options.minLevel
  ) {
    const layerMax = layer._options.maxLevel;
    layer._options.minLevel =
      layerMax !== undefined
        ? Math.min(layerMax, status.minLevel)
        : status.minLevel;
  }

  // Set frame quad if a call to setFrameQuad has been made while loading
  if (status.frame !== undefined) {
    layer.setFrameQuad?.(status.frame);
    if (options.redrawOnFirstLoad) {
      layer.draw();
    }
  }
  return status;
}
