import {
  IAnnotation,
  IDisplayLayer,
  IImage,
  IGeoJSPoint,
  AnnotationShape,
  IAnnotationProperty
} from "@/store/model";
import geojs from "geojs";
import { logError } from "@/utils/log";

// Which style an annotation should have, depending on its layer (color change)
export function getAnnotationStyleFromLayer(
  layer: IDisplayLayer | undefined,
  isHovered: boolean = false,
  isSelected: boolean = false
) {
  const style = {
    stroke: true,
    strokeColor: "black",
    strokeOpacity: 1,
    strokeWidth: 2,
    fillColor: "white",
    fillOpacity: 0.5,
    fill: true,
    radius: 10
  };

  if (layer) {
    style.fillColor = layer.color;
    style.strokeColor = layer.color;
  }
  if (isSelected) {
    style.strokeWidth = 5;
  }
  if (isHovered) {
    style.fillOpacity = 0;
  }
  return style;
}

// Get the tile's index in unrolled layer based on its XY/Z/Time location
export function unrollIndexFromImages(
  XY: number,
  Z: number,
  Time: number,
  images: IImage[]
) {
  const matchingImage = images.find(image => {
    return (
      (image.frame.IndexZ === undefined || image.frame.IndexZ === Z) &&
      (image.frame.IndexT === undefined || image.frame.IndexT === Time) &&
      (image.frame.IndexXY === undefined || image.frame.IndexXY === XY)
    );
  });

  return matchingImage?.keyOffset || 0;
}

// Create a geojs annotation depending on its shape
export function geojsAnnotationFactory(
  shape: string,
  coordinates: IGeoJSPoint[],
  options: any
) {
  let newGeoJSAnnotation = null;
  switch (shape) {
    case AnnotationShape.Point:
      newGeoJSAnnotation = geojs.annotation.pointAnnotation(options);
      newGeoJSAnnotation.options("position", coordinates[0]);
      break;
    case AnnotationShape.Polygon:
      newGeoJSAnnotation = geojs.annotation.polygonAnnotation(options);
      newGeoJSAnnotation.options("vertices", coordinates);
      break;
    case AnnotationShape.Line:
      newGeoJSAnnotation = geojs.annotation.lineAnnotation(options);
      newGeoJSAnnotation.options("vertices", coordinates);
      break;
    default:
      logError(`Unsupported annotation shape: ${shape}`);
  }
  return newGeoJSAnnotation;
}

export function simpleCentroid(coordinates: IGeoJSPoint[]): IGeoJSPoint {
  if (coordinates.length === 1) {
    return coordinates[0];
  }
  const sums = { x: 0, y: 0, z: 0 };
  const hasZ = coordinates.every(coord => coord.z !== undefined);
  coordinates.forEach(({ x, y, z }) => {
    sums.x += x;
    sums.y += y;
    if (hasZ) {
      // We know that z is not undefined
      // @ts-ignore
      sums.z += z;
    }
  });
  const centroid: IGeoJSPoint = {
    x: sums.x / coordinates.length,
    y: sums.y / coordinates.length
  };
  if (hasZ) {
    centroid.z = sums.z / coordinates.length;
  }
  return centroid;
}

export function pointDistance(a: IGeoJSPoint, b: IGeoJSPoint) {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

export function annotationDistance(a: IAnnotation, b: IAnnotation) {
  // For now, polyLines are treated as polygons for the sake of computing distances

  // Point to point
  if (a.shape === AnnotationShape.Point && b.shape === AnnotationShape.Point) {
    return pointDistance(a.coordinates[0], b.coordinates[0]);
  }

  // Point to poly
  if (
    (a.shape === AnnotationShape.Point &&
      (b.shape === AnnotationShape.Polygon ||
        b.shape === AnnotationShape.Line)) ||
    ((a.shape === AnnotationShape.Polygon ||
      b.shape === AnnotationShape.Line) &&
      b.shape === AnnotationShape.Point)
  ) {
    const point = a.shape === AnnotationShape.Point ? a : b;
    const poly = a.shape === AnnotationShape.Point ? b : a;

    // Go through all vertices to find the closest
    const shortestDistance = poly.coordinates
      .map(val => pointDistance(val, point.coordinates[0]))
      .sort()[0];
    return shortestDistance;
  }

  // Poly to poly
  if (
    (a.shape === AnnotationShape.Polygon || b.shape === AnnotationShape.Line) &&
    (b.shape === AnnotationShape.Polygon || b.shape === AnnotationShape.Line)
  ) {
    // Use centroids for now
    const centroidA = simpleCentroid(a.coordinates);
    const centroidB = simpleCentroid(b.coordinates);
    return pointDistance(centroidA, centroidB);
  }

  // Should not happen
  logError("Unsupported annotation shapes for distance calculations");
  return Number.POSITIVE_INFINITY;
}

export function canComputeAnnotationProperty(
  property: IAnnotationProperty,
  annotation: IAnnotation
) {
  return (
    property.shape === annotation.shape &&
    ((property.tags.exclusive &&
      property.tags.tags.every(tag => annotation.tags.includes(tag))) ||
      (!property.tags.exclusive &&
        property.tags.tags.some(tag => annotation.tags.includes(tag))))
  );
}
