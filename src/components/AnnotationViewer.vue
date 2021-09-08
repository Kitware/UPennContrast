<template>
  <div></div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import toolsStore from "@/store/tool";

import geojs from "geojs";

import {
  IAnnotation,
  IAnnotationConnection,
  IDisplayLayer,
  IGeoJSPoint,
  IImage,
  IToolConfiguration
} from "../store/model";

import { logWarning } from "@/utils/log";

import {
  getAnnotationStyleFromLayer,
  unrollIndexFromImages,
  geojsAnnotationFactory,
  annotationDistance,
  simpleCentroid
} from "@/utils/annotation";

import { v4 as uuidv4 } from "uuid";

// Draws annotations on the given layer, and provides functionnality for the user selected tool.
@Component
export default class AnnotationViewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly toolsStore = toolsStore;

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

  get visibleChannels() {
    return this.layers.reduce((channels: number[], layer: IDisplayLayer) => {
      if (layer.visible && !channels.includes(layer.channel)) {
        return [...channels, layer.channel];
      }
      return [];
    }, []);
  }

  // All annotations available for the currently enabled layers
  get layerAnnotations() {
    return this.annotationStore.annotations.filter(annotation =>
      this.visibleChannels.includes(annotation.assignment.channel)
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
    return this.toolsStore.selectedToolId;
  }

  get selectedTool(): IToolConfiguration | null {
    if (!this.selectedToolId) {
      return null;
    }
    const tool = this.toolsStore.tools.find(
      (tool: IToolConfiguration) => tool.id === this.selectedToolId
    );
    return tool || null;
  }

  getAnyLayerForChannel(channel: number) {
    return this.layers.find(
      (layer: IDisplayLayer) => channel === layer.channel
    );
  }

  get shouldDrawAnnotations(): boolean {
    return this.store.drawAnnotations;
  }

  get shouldDrawConnections(): boolean {
    return this.store.drawAnnotationConnections;
  }

  getAnnotationStyle(annotation: IAnnotation) {
    const layer = this.getAnyLayerForChannel(annotation.assignment.channel);
    return getAnnotationStyleFromLayer(layer);
  }

  // Get the index of the tile an annotation should be drawn in.
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

  // Transform an annotation's coordiantes, taking unrolling into account.
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

    if (!this.store.drawAnnotations) {
      this.clearOldAnnotations(true);
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

  shouldDisplayAnnotation(annotation: IAnnotation): boolean {
    if (!annotation.location) {
      return false;
    }
    if (
      (annotation.location.XY !== this.store.xy && !this.store.unrollXY) ||
      (annotation.location.Z !== this.store.z && !this.store.unrollZ) ||
      (annotation.location.Time !== this.store.time && !this.store.unrollT)
    ) {
      return false;
    }
    return true;
  }

  // Remove from the layer annotations that should no longer be renderered (index change, layer change...)
  clearOldAnnotations(clearAll = false) {
    this.annotationLayer.annotations().forEach((annotation: any) => {
      if (clearAll) {
        this.annotationLayer.removeAnnotation(annotation);
        return;
      }

      // Check for connections
      if (annotation.options("isConnection")) {
        const childId = annotation.options("childId");
        const parentId = annotation.options("parentId");
        const parent = this.annotationStore.annotations.find(
          ({ id }) => id === parentId
        );
        const child = this.annotationStore.annotations.find(
          ({ id }) => id === childId
        );
        if (
          !this.shouldDrawConnections ||
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

  // Add to the layer annotations that should be rendered and have not already been added.
  drawNewAnnotations(existingIds: string[]) {
    this.layerAnnotations
      // Check for annotation that have not been displayed yet
      .filter(annotation => !existingIds.includes(annotation.id))
      // Check for valid coordinates
      .filter(this.shouldDisplayAnnotation)
      .forEach(annotation => {
        const newGeoJSAnnotation = this.createGeoJSAnnotation(annotation);
        this.annotationLayer.addAnnotation(newGeoJSAnnotation);

        if (this.shouldDrawConnections) {
          this.annotationStore.annotationConnections
            .filter(
              (connection: IAnnotationConnection) =>
                connection.parentId === annotation.id
            )
            .forEach((connection: IAnnotationConnection) => {
              // Draw lines as a way to show the connections
              const childAnnotation = this.annotationStore.annotations.find(
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
        }
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

  // Draw lines as a way to show the connections
  drawGeoJSAnnotationFromConnection(
    connection: IAnnotationConnection,
    parent: IAnnotation,
    child: IAnnotation
  ) {
    if (!this.store.drawAnnotationConnections) {
      return;
    }
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
    const channel = layer.channel;
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
      tags: toolAnnotation.tags,
      shape: toolAnnotation.shape,
      assignment: {
        channel,
        Z: assign.Z,
        Time: assign.Time
      },
      location,
      coordinates: coordinates,
      computedValues: {
        centroid: simpleCentroid(coordinates)
      }
    };
    return newAnnotation;
  }

  private addAnnotationFromGeoJsAnnotation(annotation: any) {
    if (!annotation || !this.selectedTool) {
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
    this.annotationStore.addAnnotation(newAnnotation);
    this.annotationStore.syncAnnotations();

    this.addAnnotationConnections(newAnnotation);

    // Display the new annotation
    const newGeoJSAnnotation = this.createGeoJSAnnotation(newAnnotation);
    this.annotationLayer.removeAnnotation(annotation);
    this.annotationLayer.addAnnotation(newGeoJSAnnotation);
  }

  private addAnnotationConnections(annotation: IAnnotation) {
    if (!this.selectedTool) {
      return;
    }
    const connectTo = this.selectedTool.values.connectTo;
    // Look for connections
    if (connectTo && connectTo.tags && connectTo.tags.length) {
      const annotations = this.annotationStore.annotations;
      // Find eligible annotations (matching tags and channel)
      const connectToChannel = this.layers[connectTo.layer].channel;
      const eligibleAnnotations = annotations.filter((value: IAnnotation) => {
        if (
          connectTo.layer !== null &&
          value.assignment.channel !== connectToChannel
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
        // Find the closest among eligible annotation
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
          tags: [],
          label: "A Connection",
          parentId: closest.id,
          childId: annotation.id,
          computedValues: {
            length: annotationDistance(closest, annotation)
          }
        };
        this.annotationStore.addConnection(newConnection);
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
    switch (this.selectedTool.type) {
      case "create":
        const annotation = this.selectedTool.values.annotation;
        this.annotationLayer.mode(annotation?.shape);
        break;
      default:
        logWarning(`${this.selectedTool.type} tools are not supported yet`);
        this.annotationLayer.mode(null);
    }
  }

  handleModeChange(evt: any) {
    if (evt.mode === null) {
      this.refreshAnnotationMode();
    }
  }

  handleAnnotationChange(evt: any) {
    if (!this.selectedTool) {
      return;
    }

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
    this.annotationStore.fetchAnnotations();
  }

  @Watch("xy")
  @Watch("z")
  @Watch("time")
  @Watch("layerAnnotations")
  onLayerAnnotationsChanged() {
    this.drawAnnotations();
  }

  @Watch("shouldDrawAnnotations")
  @Watch("shouldDrawConnections")
  onSettingsChanged() {
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
