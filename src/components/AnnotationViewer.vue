<template>
  <div></div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import geojs from "geojs";

import {
  IAnnotation,
  IAnnotationConnection,
  IGeoJSPoint,
  IToolConfiguration
} from "../store/model";

@Component
export default class AnnotationViewer extends Vue {
  readonly store = store;

  @Prop()
  readonly annotationLayer: any;

  get configuration() {
    return this.store.configuration;
  }

  get layers() {
    return this.configuration?.view.layers || [];
  }

  // Fetch annotations for the current configuration
  @Watch("configuration")
  fetchAnnotations() {
    this.store.fetchAnnotations();
  }

  // All annotations available for the currently enabled layers
  get layerAnnotations() {
    return this.store.annotations.filter(
      annotation => this.layers[annotation.assignment.layer].visible
    );
  }

  getAnnotationStyle(annotation: IAnnotation) {
    const style = {
      stroke: true,
      strokeColor: "black",
      strokeOpacity: 1,
      strokeWidth: 2,
      fillColor: "#green",
      fillOpacity: 0.5,
      fill: true,
      radius: 10
    };
    if (!this.layers.length) {
      return style;
    }
    const layer = this.layers[annotation.assignment.layer];
    if (layer) {
      style.fillColor = layer.color;
      style.strokeColor = layer.color;
    }
    return style;
  }

  createGeoJSAnnotation(annotation: IAnnotation) {
    let newGeoJSAnnotation = null;
    switch (annotation.shape) {
      case "point":
        newGeoJSAnnotation = geojs.annotation.pointAnnotation();
        newGeoJSAnnotation.options("position", annotation.coordinates[0]);
        break;
      case "polygon":
        newGeoJSAnnotation = geojs.annotation.polygonAnnotation();
        newGeoJSAnnotation.options("vertices", annotation.coordinates);
        break;
      case "line":
        newGeoJSAnnotation = geojs.annotation.lineAnnotation();
        newGeoJSAnnotation.options("vertices", annotation.coordinates);
        break;
      default:
        console.error("Unsupported annotation shape", annotation.shape);
    }
    newGeoJSAnnotation.options("internalId", annotation.id);

    const style = newGeoJSAnnotation.options("style");
    const newStyle = this.getAnnotationStyle(annotation);
    newGeoJSAnnotation.options("style", Object.assign({}, style, newStyle));
    return newGeoJSAnnotation;
  }

  drawAnnotations() {
    if (!this.annotationLayer) {
      return;
    }
    // We want to ignore these already displayed annotations
    const displayedIds = this.annotationLayer
      .annotations()
      .map((a: any) => a.options("internalId"));

    const shouldDisplayAnnotation = (annotation: IAnnotation) => {
      if (!annotation.assignment) {
        return false;
      }
      const layer = this.layers[annotation.assignment.layer];
      if (!layer) {
        return false;
      }
      const indexes = this.store.layerSliceIndexes(layer);
      if (!indexes) {
        return false;
      }
      const { xyIndex, zIndex, tIndex } = indexes;
      if (
        annotation.location.XY !== xyIndex ||
        annotation.location.Z !== zIndex ||
        annotation.location.Time !== tIndex
      ) {
        return false;
      }
      return true;
    };

    // First remove undesired annotations (layer was disabled, uneligible coordinates...)
    this.annotationLayer.annotations().forEach((annotation: any) => {
      // TODO: this is temporary to debug connections
      if (annotation.options("isConnection")) {
        return;
      }

      const id = annotation.options("internalId");
      if (!id) {
        return;
      }
      const foundAnnotation = this.layerAnnotations.find(
        layerAnnotation => layerAnnotation.id === id
      );
      if (!foundAnnotation || !shouldDisplayAnnotation(foundAnnotation)) {
        this.annotationLayer.removeAnnotation(annotation);
      }
    });

    // Then draw the new annotations
    this.layerAnnotations
      // Check for annotation that have not been displayed yet
      .filter(annotation => !displayedIds.includes(annotation.id))
      // Check for valid coordinates
      .filter(shouldDisplayAnnotation)
      .forEach(annotation => {
        const newGeoJSAnnotation = this.createGeoJSAnnotation(annotation);
        this.annotationLayer.addAnnotation(newGeoJSAnnotation);
      });
  }

  get xy() {
    return this.store.xy;
  }

  get z() {
    return this.store.z;
  }

  get time() {
    return this.store.time;
  }

  @Watch("xy")
  @Watch("z")
  @Watch("time")
  @Watch("layerAnnotations")
  onLayerAnnotationsChanged() {
    this.drawAnnotations();
  }

  get dataset() {
    return this.store.dataset;
  }

  get selectedToolId() {
    return this.store.selectedToolId;
  }

  get selectedTool(): any {
    if (!this.selectedToolId) {
      return null;
    }
    const tool = this.store.tools.find(
      (tool: IToolConfiguration) => tool.id === this.selectedToolId
    );
    return tool;
  }

  refreshAnnotationMode() {
    if (this.selectedTool?.type === "create") {
      const annotation = this.selectedTool.values.annotation;
      this.annotationLayer.mode(annotation?.shape);
    } else if (this.selectedTool.type === "edit") {
      // TODO: PH, need to look at subtype
      // TODO: Create a new annotation layer ?
    } else {
      // is it that easy to cancel ?
      this.annotationLayer.mode(null);
    }
  }

  @Watch("selectedTool")
  watchTool() {
    this.refreshAnnotationMode();
  }

  handleModeChange(evt: any) {
    if (evt.mode === null) {
      this.refreshAnnotationMode();
    }
  }

  private addAnnotationFromGeoJsAnnotation(annotation: any) {
    if (
      !annotation ||
      !annotation.coordinates() ||
      !annotation.coordinates().length
    ) {
      return;
    }
    const toolAnnotation = this.selectedTool.values.annotation;

    // Find location in the assigned layer
    const location = {
      XY: this.store.xy,
      Z: this.store.z,
      Time: this.store.time
    };
    const layer = this.layers[toolAnnotation.coordinateAssignments.layer];
    if (layer) {
      const indexes = this.store.layerSliceIndexes(layer);
      if (indexes) {
        const { xyIndex, zIndex, tIndex } = indexes;
        location.XY = xyIndex;
        location.Z = zIndex;
        location.Time = tIndex;
      }
    }

    // Create the new annotation
    const newAnnotation: IAnnotation = {
      id: `${Date.now()}`, // TODO: uuid
      label: toolAnnotation.name, // TODO: rename one of these
      tags: toolAnnotation.tags,
      shape: toolAnnotation.shape,
      assignment: toolAnnotation.coordinateAssignments,
      location,
      coordinates: annotation.coordinates(),
      computedValues: {} // TODO: if blob, should at least compute centroid
    };

    // TODO: factorize
    this.findAnnotationConnections(newAnnotation);

    // Make sure we know which annotation this geojs object is associated to
    annotation.options("internalId", newAnnotation.id);

    const style = annotation.options("style");
    const newStyle = this.getAnnotationStyle(newAnnotation);
    annotation.options("style", Object.assign({}, style, newStyle));

    // Save the new annotation
    this.store.addAnnotation(newAnnotation);
    this.store.syncAnnotations();
  }

  handleAnnotationChange(evt: any) {
    // if (this.annotationStyle && evt.annotation) {
    //   evt.annotation.style(this.annotationStyle.style); // TODO: ask about annotation style
    // }
    switch (evt.event) {
      case "geo_annotation_state":
        if (this.selectedTool.type === "create") {
          this.addAnnotationFromGeoJsAnnotation(evt.annotation);
        }
        break;
      default:
        break;
    }
  }

  @Watch("annotationLayer")
  bind() {
    this.annotationLayer.geoOn(
      geojs.event.annotation.mode,
      this.handleModeChange
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.add,
      this.handleAnnotationChange
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.update,
      this.handleAnnotationChange
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.state,
      this.handleAnnotationChange
    );
    this.drawAnnotations();
  }

  mounted() {
    this.fetchAnnotations();
    this.bind();
  }

  private placeholderCentroid(coordinates: IGeoJSPoint[]): IGeoJSPoint {
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

  private annotationDistance(a: IAnnotation, b: IAnnotation) {
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
      const centroidA = this.placeholderCentroid(a.coordinates);
      const centroidB = this.placeholderCentroid(b.coordinates);
      return dist(centroidA, centroidB);
    }

    // Should not happen
    console.error("Unsupported annotation shapes for distance calculations");
    return Number.POSITIVE_INFINITY;
  }

  private findAnnotationConnections(annotation: IAnnotation) {
    const connectTo = this.selectedTool.values.connectTo;
    // Look for connections
    if (connectTo && connectTo.tags && connectTo.tags.length) {
      const annotations = this.store.annotations;
      // Find eligible annotations (matching tags and channel)
      const eligibleAnnotations = annotations.filter((value: IAnnotation) => {
        if (
          connectTo.layer !== null &&
          value.assignment.layer !== connectTo.layer
        ) {
          return false;
        }
        if (
          annotation.location.XY !== value.location.XY ||
          annotation.location.Z !== value.location.Z ||
          annotation.location.Time !== value.location.Time
        ) {
          return false;
        }
        return value.tags.some(tag => connectTo.tags.includes(tag)); // TODO: check channel as well
      });
      if (eligibleAnnotations.length) {
        // Find the closest eligible annotation
        const sortedAnnotations = eligibleAnnotations.sort(
          (valueA: IAnnotation, valueB: IAnnotation) => {
            const distanceA = this.annotationDistance(valueA, annotation);
            const distanceB = this.annotationDistance(valueB, annotation);
            return distanceA - distanceB;
          }
        );
        const [closest] = sortedAnnotations;

        // Create and add the new connection
        const newConnection: IAnnotationConnection = {
          id: `${Date.now()}`,
          tags: [], // TODO: nothing is speced for connection tags right now
          label: "A Connection",
          parentId: closest.id,
          childId: annotation.id,
          computedValues: {
            length: this.annotationDistance(closest, annotation)
          }
        };
        this.store.addConnection(newConnection);

        // TEMP: Draw lines as a way to show the connections
        const pA = this.placeholderCentroid(closest.coordinates);
        const pB = this.placeholderCentroid(annotation.coordinates);
        const line = geojs.annotation.lineAnnotation();
        line.options("vertices", [pA, pB]);
        line.options("isConnection", true);
        this.annotationLayer.addAnnotation(line);
      }
    }
  }
}
</script>

<style lang="scss" scoped></style>
