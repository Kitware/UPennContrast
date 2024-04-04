declare module "geojs" {
  import {
    IGeoJSAnnotation,
    IGeoJSColorObject,
    IGeoJSLineAnnotationSpec,
    IGeoJSMap,
    IGeoJSMapInteractor,
    IGeoJSMapInteractorSpec,
    IGeoJSMapSpec,
    IGeoJSPosition,
    IGeoJSPointAnnotationSpec,
    IGeoJSPolygonAnnotationSpec,
    IGeoJSPolygonObject,
    IGeoJSRectangleAnnotationSpec,
    TGeoJSColor,
    IGeoJSPoint2D,
    IGeoJSPixelCoordinateParams,
  } from "@/store/model";

  // https://opengeoscience.github.io/geojs/apidocs/geo.html#.createAnnotation
  export function createAnnotation(
    name: string,
    options?: object,
  ): IGeoJSAnnotation;

  // https://opengeoscience.github.io/geojs/apidocs/geo.html#.listAnnotations
  export function listAnnotations(): string[];

  // https://opengeoscience.github.io/geojs/apidocs/geo.map.html#map
  export function map(arg: IGeoJSMapSpec): IGeoJSMap;

  // https://opengeoscience.github.io/geojs/apidocs/geo.mapInteractor.html#mapInteractor
  export function mapInteractor(
    args: IGeoJSMapInteractorSpec,
  ): IGeoJSMapInteractor;

  // https://opengeoscience.github.io/geojs/apidocs/event.js.html
  export const event: {
    layerAdd: "geo_layerAdd";
    layerRemove: "geo_layerRemove";
    layerMove: "geo_layerMove";
    zoom: "geo_zoom";
    rotate: "geo_rotate";
    pan: "geo_pan";
    resize: "geo_resize";
    draw: "geo_draw";
    drawEnd: "geo_drawEnd";
    unhidden: "geo_unhidden";
    hidden: "geo_hidden";
    mousemove: "geo_mousemove";
    mouseclick: "geo_mouseclick";
    mouseup: "geo_mouseup";
    mousedown: "geo_mousedown";
    brush: "geo_brush";
    brushend: "geo_brushend";
    brushstart: "geo_brushstart";
    select: "geo_select";
    zoomselect: "geo_zoomselect";
    unzoomselect: "geo_unzoomselect";
    actiondown: "geo_actiondown";
    actionmove: "geo_actionmove";
    actionup: "geo_actionup";
    actionselection: "geo_actionselection";
    actionwheel: "geo_actionwheel";
    keyaction: "geo_keyaction";
    transitionstart: "geo_transitionstart";
    transitionend: "geo_transitionend";
    transitioncancel: "geo_transitioncancel";
    parallelprojection: "geo_parallelprojection";
    feature: {
      mousemove: "geo_feature_mousemove";
      mouseover: "geo_feature_mouseover";
      mouseover_order: "geo_feature_mouseover_order";
      mouseout: "geo_feature_mouseout";
      mouseon: "geo_feature_mouseon";
      mouseoff: "geo_feature_mouseoff";
      mouseclick: "geo_feature_mouseclick";
      mouseclick_order: "geo_feature_mouseclick_order";
      mousedown: "geo_feature_mousedown";
      mouseup: "geo_feature_mouseup";
      brushend: "geo_feature_brushend";
      brush: "geo_feature_brush";
    };
    pixelmap: { prepared: "geo_pixelmap_prepared" };
    screenshot: { ready: "geo_screenshot_ready" };
    camera: {
      view: "geo_camera_view";
      projection: "geo_camera_projection";
      viewport: "geo_camera_viewport";
    };
    annotation: {
      add: "geo_annotation_add";
      add_before: "geo_annotation_add_before";
      update: "geo_annotation_update";
      coordinates: "geo_annotation_coordinates";
      select_edit_handle: "geo_annotation_select_edit_handle";
      edit_action: "geo_annotation_edit_action";
      remove: "geo_annotation_remove";
      state: "geo_annotation_state";
      mode: "geo_annotation_mode";
      boolean: "geo_annotation_boolean";
      cursor_click: "geo_annotation_cursor_click";
      cursor_action: "geo_annotation_cursor_action";
    };
  };

  export const util: {
    // https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.rdpLineSimplify
    rdpLineSimplify(
      pts: IGeoJSPosition[],
      tolerance: number,
      closed?: boolean,
      noCrossLines?: null | IGeoJSPosition[][],
    ): IGeoJSPosition[];

    // https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.convertColor
    convertColor(color: TGeoJSColor): IGeoJSColorObject;

    // https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.distance2dToLineSquared
    distance2dToLineSquared(
      pt: IGeoJSPosition,
      line1: IGeoJSPosition,
      line2: IGeoJSPosition,
    ): number;

    // https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.distanceToPolygon2d
    distanceToPolygon2d(
      pt: IGeoJSPosition,
      poly: IGeoJSPolygonObject,
      onlySign?: boolean,
    ): number;

    // https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.pixelCoordinateParams
    pixelCoordinateParams(
      node: string | null | HTMLElement,
      width: number,
      height: number,
      tileWidth?: number,
      tileHeight?: number,
    ): IGeoJSPixelCoordinateParams;

    // https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.pointInPolygon
    pointInPolygon(
      point: IGeoJSPoint2D,
      outer: IGeoJSPoint2D[] | IGeoJSPolygonObject,
      inner?: IGeoJSPoint2D[][],
      range?: { min: IGeoJSPoint2D; max: IGeoJSPoint2D },
    ): boolean;
  };

  export const annotation: {
    // https://opengeoscience.github.io/geojs/apidocs/geo.pointAnnotation.html#pointAnnotation
    pointAnnotation(args?: IGeoJSPointAnnotationSpec | null): IGeoJSAnnotation;

    // https://opengeoscience.github.io/geojs/apidocs/geo.lineAnnotation.html#lineAnnotation
    lineAnnotation(args?: IGeoJSLineAnnotationSpec | null): IGeoJSAnnotation;

    // https://opengeoscience.github.io/geojs/apidocs/geo.rectangleAnnotation.html#rectangleAnnotation
    rectangleAnnotation(
      args?: IGeoJSRectangleAnnotationSpec | null,
      annotationName?: string,
    ): IGeoJSAnnotation;

    // https://opengeoscience.github.io/geojs/apidocs/geo.polygonAnnotation.html#polygonAnnotation
    polygonAnnotation(
      args?: IGeoJSPolygonAnnotationSpec | null,
    ): IGeoJSAnnotation;
  };

  export const transform: {
    // https://opengeoscience.github.io/geojs/apidocs/geo.transform.html#.transformCoordinates
    transformCoordinates<
      T extends IGeoJSPosition | IGeoJSPosition[] | number[],
    >(
      srcPrj: string,
      tgtPrj: string,
      coordinates: T,
      numberOfComponents?: number,
    ): T;
  };
}
