import { IAnnotation, IDisplayLayer, IImage, IGeoJSPoint } from "@/store/model";
import geojs from "geojs";
import { logError } from "@/utils/log";

// Which style an annotation should have, depending on its layer (color change)
export function getAnnotationStyleFromLayer(layer: IDisplayLayer | undefined) {
  const style = {
    stroke: true,
    strokeColor: "black",
    strokeOpacity: 1,
    strokeWidth: 2,
    fillColor: "#white",
    fillOpacity: 0.5,
    fill: true,
    radius: 10
  };
  if (!layer) {
    return style;
  }
  if (layer) {
    style.fillColor = layer.color;
    style.strokeColor = layer.color;
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
      image.frame.IndexZ === Z &&
      image.frame.IndexT === Time &&
      image.frame.IndexXY === XY
    );
  });

  return matchingImage?.keyOffset || 0;
}

// Create a geojs annotation depending on its shape
export function geojsAnnotationFactory(
  shape: string,
  coordinates: IGeoJSPoint[]
) {
  let newGeoJSAnnotation = null;
  switch (shape) {
    case "point":
      newGeoJSAnnotation = geojs.annotation.pointAnnotation();
      newGeoJSAnnotation.options("position", coordinates[0]);
      break;
    case "polygon":
      newGeoJSAnnotation = geojs.annotation.polygonAnnotation();
      newGeoJSAnnotation.options("vertices", coordinates);
      break;
    case "line":
      newGeoJSAnnotation = geojs.annotation.lineAnnotation();
      newGeoJSAnnotation.options("vertices", coordinates);
      break;
    default:
      logError(`Unsupported annotation shape: ${shape}`);
  }
  return newGeoJSAnnotation;
}

export function simpleCentroid(coordinates: IGeoJSPoint[]): IGeoJSPoint {
  const sums: IGeoJSPoint = { x: 0, y: 0, z: 0 };
  coordinates.forEach(({ x, y, z }) => {
    sums.x += x;
    sums.y += y;
    sums.z += z;
  });
  return {
    x: sums.x / coordinates.length,
    y: sums.y / coordinates.length,
    z: sums.z / coordinates.length
  };
}

export function annotationDistance(a: IAnnotation, b: IAnnotation) {
  // For now, polyLines are treated as polygons for the sake of computing distances
  const dist = (a: IGeoJSPoint, b: IGeoJSPoint): number =>
    Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  // Point to point
  if (a.shape === "point" || b.shape === "point") {
    return dist(a.coordinates[0], b.coordinates[0]);
  }

  // Point to poly
  if (
    (a.shape === "point" && (b.shape === "polygon" || b.shape === "line")) ||
    ((a.shape === "polygon" || b.shape === "line") && b.shape === "point")
  ) {
    const point = a.shape === "point" ? a : b;
    const poly = a.shape === "point" ? b : a;

    // Go through all vertices to find the closest
    const shortestDistance = poly.coordinates
      .map(val => dist(val, point.coordinates[0]))
      .sort()[0];
    return shortestDistance;
  }

  // Poly to poly
  if (
    (a.shape === "polygon" || b.shape === "line") &&
    (b.shape === "polygon" || b.shape === "line")
  ) {
    // Use centroids for now
    const centroidA = simpleCentroid(a.coordinates);
    const centroidB = simpleCentroid(b.coordinates);
    return dist(centroidA, centroidB);
  }

  // Should not happen
  logError("Unsupported annotation shapes for distance calculations");
  return Number.POSITIVE_INFINITY;
}
