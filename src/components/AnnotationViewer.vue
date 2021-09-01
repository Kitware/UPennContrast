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
  IImage,
  IToolConfiguration
} from "../store/model";

import { warning, error } from "@/utils/log";

import {
  getAnnotationStyleFromLayer,
  unrollIndexFromImages,
  geojsAnnotationFactory,
  annotationDistance,
  simpleCentroid
} from "@/utils/annotation";

import { v4 as uuidv4 } from "uuid";

@Component
export default class AnnotationViewer extends Vue {
  readonly store = store;

  @Prop()
  readonly annotationLayer: any;

  @Prop()
  readonly unrollH: any;

  @Prop()
  readonly unrollW: any;

  get configuration() {
    return this.store.configuration;
  }

  get layers() {
    return this.configuration?.view.layers || [];
  }

  // All annotations available for the currently enabled layers
  get layerAnnotations() {
    return this.store.annotations.filter(
      annotation => this.layers[annotation.assignment.layer].visible
    );
  }

  get unrolling() {
    return this.store.unrollXY || this.store.unrollZ || this.store.unrollT;
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

  getAnnotationStyle(annotation: IAnnotation) {
    const layer = this.layers[annotation.assignment.layer];
    return getAnnotationStyleFromLayer(layer);
  }

  unrollIndex(
    XY: number,
    Z: number,
    Time: number,
    unrollXY: boolean,
    unrollZ: boolean,
    unrollT: boolean
  ) {
    const images = this.store.dataset?.images(
      unrollZ ? -1 : Z,
      unrollT ? -1 : Time,
      unrollXY ? -1 : XY,
      0
    );
    if (!images) {
      return 0;
    }
    return unrollIndexFromImages(XY, Z, Time, images);
  }

  unrolledCoordinates(annotation: IAnnotation, image: IImage) {
    const tileW = image.sizeX;
    const tileH = image.sizeY;
    if (this.unrolling) {
      const location = this.unrollIndex(
        annotation.location.XY,
        annotation.location.Z,
        annotation.location.Time,
        this.store.unrollXY,
        this.store.unrollZ,
        this.store.unrollT
      );

      const tileX = Math.floor(location % this.unrollW);
      const tileY = Math.floor(location / this.unrollW);

      return annotation.coordinates.map((point: IGeoJSPoint) => ({
        x: tileW * tileX + point.x,
        y: tileH * tileY + point.y,
        z: point.z
      }));
    }
    return annotation.coordinates;
  }

  drawAnnotations() {
    if (!this.annotationLayer) {
      return;
    }
    // We want to ignore these already displayed annotations
    const displayedIds = this.annotationLayer
      .annotations()
      .map((a: any) => a.options("girderId"));

    // First remove undesired annotations (layer was disabled, uneligible coordinates...)
    this.clearOldAnnotations();

    // Then draw the new annotations
    this.drawNewAnnotations(displayedIds);
  }

  shouldDisplayAnnotation(annotation: IAnnotation) {
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
      (annotation.location.XY !== xyIndex && !this.store.unrollXY) ||
      (annotation.location.Z !== zIndex && !this.store.unrollZ) ||
      (annotation.location.Time !== tIndex && !this.store.unrollT)
    ) {
      return false;
    }
    return true;
  }

  clearOldAnnotations(clearAll = false) {
    this.annotationLayer.annotations().forEach((annotation: any) => {
      if (clearAll) {
        this.annotationLayer.removeAnnotation(annotation);
        return;
      }

      // TODO: this is temporary to debug connections
      if (annotation.options("isConnection")) {
        const childId = annotation.options("childId");
        const parentId = annotation.options("parentId");
        const parent = this.store.annotations.find(({ id }) => id === parentId);
        const child = this.store.annotations.find(({ id }) => id === childId);
        if (
          !parent ||
          !child ||
          !this.shouldDisplayAnnotation(parent) ||
          !this.shouldDisplayAnnotation(child)
        ) {
          this.annotationLayer.removeAnnotation(annotation);
        }
        return;
      }

      const id = annotation.options("girderId");
      if (!id) {
        return;
      }
      const foundAnnotation = this.layerAnnotations.find(
        layerAnnotation => layerAnnotation.id === id
      );
      if (!foundAnnotation || !this.shouldDisplayAnnotation(foundAnnotation)) {
        this.annotationLayer.removeAnnotation(annotation);
      }
    });
  }

  drawNewAnnotations(annotationIds: string[]) {
    this.layerAnnotations
      // Check for annotation that have not been displayed yet
      .filter(annotation => !annotationIds.includes(annotation.id))
      // Check for valid coordinates
      .filter(this.shouldDisplayAnnotation)
      .forEach(annotation => {
        const newGeoJSAnnotation = this.createGeoJSAnnotation(annotation);
        this.annotationLayer.addAnnotation(newGeoJSAnnotation);

        // TEMP: find and draw connections for this annotation
        this.store.annotationConnections
          .filter(
            (connection: IAnnotationConnection) =>
              connection.parentId === annotation.id
          )
          .forEach((connection: IAnnotationConnection) => {
            // TEMP: Draw lines as a way to show the connections
            const childAnnotation = this.store.annotations.find(
              (child: IAnnotation) => child.id === connection.childId
            );
            if (
              !childAnnotation ||
              !this.shouldDisplayAnnotation(childAnnotation)
            ) {
              return;
            }
            this.drawGeoJSAnnotationFromConnection(
              connection,
              childAnnotation,
              annotation
            );
          });
      });
  }

  createGeoJSAnnotation(annotation: IAnnotation) {
    if (!this.store.dataset) {
      return;
    }

    const anyImage = this.store.dataset?.anyImage();
    if (!anyImage) {
      return;
    }

    const coordinates = this.unrolledCoordinates(annotation, anyImage);

    const newGeoJSAnnotation = geojsAnnotationFactory(
      annotation.shape,
      coordinates
    );
    newGeoJSAnnotation.options("girderId", annotation.id);

    const style = newGeoJSAnnotation.options("style");
    const newStyle = this.getAnnotationStyle(annotation);
    newGeoJSAnnotation.options("style", Object.assign({}, style, newStyle));

    return newGeoJSAnnotation;
  }

  drawGeoJSAnnotationFromConnection(
    connection: IAnnotationConnection,
    parent: IAnnotation,
    child: IAnnotation
  ) {
    // TEMP: Draw lines as a way to show the connections
    const anyImage = this.store.dataset?.anyImage();

    if (!anyImage) {
      return;
    }

    const pA = simpleCentroid(this.unrolledCoordinates(child, anyImage));
    const pB = simpleCentroid(this.unrolledCoordinates(parent, anyImage));
    const line = geojs.annotation.lineAnnotation();
    line.options("vertices", [pA, pB]);
    line.options("isConnection", true);
    line.options("childId", connection.childId);
    line.options("parentId", connection.parentId);
    this.annotationLayer.addAnnotation(line);
  }

  private createAnnotationFromTool(
    coordinates: IGeoJSPoint[],
    tool: IToolConfiguration
  ) {
    if (!coordinates || !coordinates.length) {
      return null;
    }
    const toolAnnotation = tool.values.annotation;
    // Find location in the assigned layer
    const location = {
      XY: this.store.xy,
      Z: this.store.z,
      Time: this.store.time
    };
    const layer = this.layers[toolAnnotation.coordinateAssignments.layer];
    const assign = toolAnnotation.coordinateAssignments;
    if (layer) {
      const indexes = this.store.layerSliceIndexes(layer);
      if (indexes) {
        const { xyIndex, zIndex, tIndex } = indexes;
        location.XY = xyIndex;
        location.Z =
          assign.Z.type === "layer" ? zIndex : Number.parseInt(assign.Z.value);
        location.Time =
          assign.Time.type === "layer"
            ? tIndex
            : Number.parseInt(assign.Time.value);
      }
    }

    // Create the new annotation
    const newAnnotation: IAnnotation = {
      id: uuidv4(),
      label: toolAnnotation.label,
      tags: toolAnnotation.tags,
      shape: toolAnnotation.shape,
      assignment: toolAnnotation.coordinateAssignments,
      location,
      coordinates: coordinates,
      computedValues: {
        centroid: simpleCentroid(coordinates)
      }
    };
    return newAnnotation;
  }

  private addAnnotationFromGeoJsAnnotation(annotation: any) {
    if (!annotation) {
      return;
    }

    // Create the new annotation
    const newAnnotation: IAnnotation | null = this.createAnnotationFromTool(
      annotation.coordinates(),
      this.selectedTool
    );

    if (!newAnnotation) {
      return;
    }

    // Save the new annotation
    this.store.addAnnotation(newAnnotation);
    this.store.syncAnnotations();

    this.addAnnotationConnections(newAnnotation);

    // Display the new annotation
    const newGeoJSAnnotation = this.createGeoJSAnnotation(newAnnotation);
    this.annotationLayer.removeAnnotation(annotation);
    this.annotationLayer.addAnnotation(newGeoJSAnnotation);
  }

  private addAnnotationConnections(annotation: IAnnotation) {
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
        return value.tags.some(tag => connectTo.tags.includes(tag));
      });
      if (eligibleAnnotations.length) {
        // Find the closest eligible annotation
        const sortedAnnotations = eligibleAnnotations.sort(
          (valueA: IAnnotation, valueB: IAnnotation) => {
            const distanceA = annotationDistance(valueA, annotation);
            const distanceB = annotationDistance(valueB, annotation);
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
            length: annotationDistance(closest, annotation)
          }
        };
        this.store.addConnection(newConnection);
        this.drawGeoJSAnnotationFromConnection(
          newConnection,
          annotation,
          closest
        );
      }
    }
  }

  refreshAnnotationMode() {
    if (!this.selectedTool || this.unrolling) {
      this.annotationLayer.mode(null);
      return;
    }
    switch (this.selectedTool?.type) {
      case "create":
        const annotation = this.selectedTool.values.annotation;
        this.annotationLayer.mode(annotation?.shape);
        break;
      default:
        warning(`${this.selectedTool.type} tools are not supported yet`);
    }
  }

  handleModeChange(evt: any) {
    if (evt.mode === null) {
      this.refreshAnnotationMode();
    }
  }

  handleAnnotationChange(evt: any) {
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

  @Watch("unrolling")
  toggleAnnotationModeWhenUnrolling() {
    this.refreshAnnotationMode();
  }

  // Fetch annotations for the current configuration
  @Watch("configuration")
  fetchAnnotations() {
    this.store.fetchAnnotations();
  }

  @Watch("xy")
  @Watch("z")
  @Watch("time")
  @Watch("layerAnnotations")
  onLayerAnnotationsChanged() {
    this.drawAnnotations();
  }

  @Watch("unrollH")
  @Watch("unrollW")
  onUnrollChanged() {
    this.clearOldAnnotations(true);
    this.drawAnnotations();
  }

  @Watch("selectedTool")
  watchTool() {
    this.refreshAnnotationMode();
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
}
</script>

<style lang="scss" scoped></style>
