import {
  IAnnotation,
  IAnnotationProperty,
  IAnnotationPropertyComputeParameters,
  IGeoJSPoint,
  IAnnotationConnection,
  IRelationalAnnotationProperty
} from "@/store/model";

function pointDistance(a: IGeoJSPoint, b: IGeoJSPoint) {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
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

// TODO: DUPLICATION
export function annotationDistance(a: IAnnotation, b: IAnnotation) {
  // For now, polyLines are treated as polygons for the sake of computing distances

  // Point to point
  if (a.shape === "point" || b.shape === "point") {
    return pointDistance(a.coordinates[0], b.coordinates[0]);
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
      .map(val => pointDistance(val, point.coordinates[0]))
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
    return pointDistance(centroidA, centroidB);
  }

  // Should not happen
  return Number.POSITIVE_INFINITY;
}

const ctx: Worker = self as any;

const methods: {
  [key: string]: (
    annotation: IAnnotation,
    property: IAnnotationProperty,
    parameters: IAnnotationPropertyComputeParameters
  ) => number;
} = {
  length: (
    annotation: IAnnotation
    // property: IAnnotationProperty,
    // parameters: IAnnotationPropertyComputeParameters
  ) => {
    let sum = 0;
    for (let i = 1; i < annotation.coordinates.length; ++i) {
      sum += pointDistance(
        annotation.coordinates[i - 1],
        annotation.coordinates[i]
      );
    }
    return sum;
  },
  perimeter: (
    annotation: IAnnotation
    // property: IAnnotationProperty,
    // parameters: IAnnotationPropertyComputeParameters
  ) => {
    let sum = 0;
    for (let i = 1; i < annotation.coordinates.length; ++i) {
      sum += pointDistance(
        annotation.coordinates[i - 1],
        annotation.coordinates[i]
      );
    }
    sum += pointDistance(
      annotation.coordinates[0],
      annotation.coordinates[annotation.coordinates.length - 1]
    );
    return sum;
  },
  numberOfConnected: (
    annotation: IAnnotation,
    property: IAnnotationProperty,
    parameters: IAnnotationPropertyComputeParameters
  ) => {
    // TODO: filter by tag
    return (
      parameters.connections?.filter((connection: IAnnotationConnection) => {
        connection.childId === annotation.id ||
          connection.parentId === annotation.id;
      }).length || 0
    );
  },
  distanceToNearest: (
    annotation: IAnnotation,
    property: IAnnotationProperty,
    parameters: IAnnotationPropertyComputeParameters
  ) => {
    const filter = (property as IRelationalAnnotationProperty).filter;
    if (!filter) {
      return 0.0;
    }
    const f = (value: IAnnotation) => {
      const hasAllTags = filter.tags.reduce(
        (val: boolean, tag: string) => val && value.tags.includes(tag),
        true
      );
      if (
        hasAllTags &&
        filter.exclusive &&
        !value.tags
          .map((tag: string) => filter.tags.includes(tag))
          .every((val: boolean) => val)
      ) {
        return false;
      }
      return hasAllTags;
    };
    const sortedDistances = parameters.additionalAnnotations
      .filter(f)
      .map((value: IAnnotation) => annotationDistance(annotation, value))
      .sort((a: number, b: number) => a - b);
    if (sortedDistances && sortedDistances.length > 0) {
      // 1 because current annotation is present too
      return sortedDistances[1];
    }
    return 0.0;
  },
  averageIntensity: () =>
    // annotation: IAnnotation,
    // property: IAnnotationProperty,
    // parameters: IAnnotationPropertyComputeParameters
    {
      return Math.random() * 1000;
    }
};

// Respond to message from parent thread
ctx.addEventListener("message", event => {
  if (!event.data) {
    return;
  }
  const property: IAnnotationProperty = event.data.property;
  const parameters: IAnnotationPropertyComputeParameters =
    event.data.parameters;

  const method = methods[property.id];
  const annotationIds = parameters.annotationsToCompute.map(
    (annotation: IAnnotation) => annotation.id
  );
  const values = parameters.annotationsToCompute.map(
    (annotation: IAnnotation) => method(annotation, property, parameters)
  );
  const result = {
    propertyId: property.id,
    annotationIds,
    values
  };

  ctx.postMessage(result);
});
