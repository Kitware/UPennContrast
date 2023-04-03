<template>
  <div v-mousetrap="mousetrapAnnotations"></div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import toolsStore from "@/store/tool";
import propertiesStore from "@/store/properties";
import filterStore from "@/store/filters";

import geojs from "geojs";
import { snapCoordinates } from "@/utils/itk";

import {
  IAnnotation,
  IAnnotationConnection,
  IDisplayLayer,
  IGeoJSPoint,
  IImage,
  IToolConfiguration,
  IROIAnnotationFilter,
  AnnotationShape,
  AnnotationSelectionTypes,
  IAnnotationLocation,
  IGeoJSAnnotation
} from "../store/model";

import { logError, logWarning } from "@/utils/log";

import {
  pointDistance,
  getAnnotationStyleFromLayer,
  unrollIndexFromImages,
  geojsAnnotationFactory
} from "@/utils/annotation";

// Draws annotations on the given layer, and provides functionnality for the user selected tool.
@Component({ components: {} })
export default class AnnotationViewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly toolsStore = toolsStore;
  readonly propertyStore = propertiesStore;
  readonly filterStore = filterStore;

  // Compute the centroid of each annotation, taking unrolling into account
  get unrolledCentroidCoordinates() {
    const centroidMap: { [annotationId: string]: IGeoJSPoint } = {};
    const annotationCentroids = this.annotationStore.annotationCentroids;

    const anyImage = this.store.dataset?.anyImage();
    if (anyImage) {
      for (const annotation of this.annotationStore.annotations) {
        const centroid = annotationCentroids[annotation.id];
        const unrolledCentroid = this.unrolledCoordinates(
          [centroid],
          annotation.location,
          anyImage
        )[0];
        centroidMap[annotation.id] = unrolledCentroid;
      }
    }

    return centroidMap;
  }

  get annotationSelectionType() {
    return this.store.annotationSelectionType;
  }

  get roiFilter() {
    return this.filterStore.emptyROIFilter;
  }

  get enabledRoiFilters() {
    return this.filterStore.roiFilters.filter(
      (filter: IROIAnnotationFilter) => filter.enabled
    );
  }

  @Prop()
  readonly annotationLayer: any;

  @Prop()
  readonly textLayer: any;

  @Prop()
  readonly workerPreviewFeature: any;

  @Prop()
  readonly unrollH: any;

  @Prop()
  readonly unrollW: any;

  @Prop({ default: [] })
  readonly maps!: any[];

  @Prop()
  readonly tileWidth: any;

  @Prop()
  readonly tileHeight: any;

  @Prop()
  readonly lowestLayer: any;

  @Prop()
  readonly layerCount: any;

  get displayWorkerPreview() {
    return this.propertyStore.displayWorkerPreview;
  }

  get configuration() {
    return this.store.configuration;
  }

  get layers() {
    return this.configuration?.layers || [];
  }

  get filteredAnnotations() {
    return this.filterStore.filteredAnnotations;
  }

  get annotationConnections() {
    return this.annotationStore.annotationConnections;
  }

  get unrolling() {
    return this.store.unroll;
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

  get workerImage() {
    return this.selectedTool?.values?.image?.image;
  }

  get workerPreview() {
    return this.workerImage
      ? this.propertyStore.getWorkerPreview(this.workerImage)
      : { text: null, image: "" };
  }

  // Check if an annotation is selected on store using its girderId
  isAnnotationSelected(annotationId: string) {
    return this.annotationStore.selectedAnnotationIds.includes(annotationId);
  }

  @Watch("displayWorkerPreview")
  @Watch("workerPreview")
  renderWorkerPreview() {
    if (this.workerPreview?.image && this.displayWorkerPreview) {
      this.workerPreviewFeature.data([
        {
          ul: { x: 0, y: 0 },
          lr: { x: this.tileWidth, y: this.tileHeight },
          image: this.workerPreview.image
        }
      ]);
    } else {
      this.workerPreviewFeature.data([]);
    }
    this.workerPreviewFeature.draw();
  }

  get selectedTool(): IToolConfiguration | null {
    return this.toolsStore.selectedTool;
  }

  get hoveredAnnotationId() {
    return this.annotationStore.hoveredAnnotationId;
  }

  get selectedAnnotations() {
    return this.annotationStore.selectedAnnotations;
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

  get showTooltips(): boolean {
    return this.store.showTooltips;
  }

  get filteredAnnotationTooltips(): boolean {
    return this.store.filteredAnnotationTooltips;
  }

  get getAnnotationFromId() {
    return this.annotationStore.getAnnotationFromId;
  }

  getAnnotationStyle(annotationId: string, layerColor: string | undefined) {
    const hovered = annotationId === this.hoveredAnnotationId;
    const selected = this.isAnnotationSelected(annotationId);
    return getAnnotationStyleFromLayer(layerColor, hovered, selected);
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

  // Transform a list of coordinates, taking unrolling into account.
  unrolledCoordinates(
    coordinates: IGeoJSPoint[],
    location: IAnnotationLocation,
    image: IImage
  ) {
    const tileW = image.sizeX;
    const tileH = image.sizeY;
    if (this.unrolling) {
      const locationIdx = this.unrollIndex(
        location.XY,
        location.Z,
        location.Time,
        this.store.unrollXY,
        this.store.unrollZ,
        this.store.unrollT
      );

      const tileX = Math.floor(locationIdx % this.unrollW);
      const tileY = Math.floor(locationIdx / this.unrollW);

      return coordinates.map((point: IGeoJSPoint) => ({
        x: tileW * tileX + point.x,
        y: tileH * tileY + point.y,
        z: point.z
      }));
    }
    return coordinates;
  }

  drawAnnotationsAndTooltips() {
    this.drawAnnotations();
    this.drawTooltips();
  }

  drawAnnotations() {
    if (!this.annotationLayer) {
      return;
    }

    if (!this.shouldDrawAnnotations) {
      this.clearOldAnnotations(true);
      return;
    }

    // First remove undesired annotations (layer was disabled, uneligible coordinates...)
    this.clearOldAnnotations(false, false);

    // We want to ignore these already displayed annotations
    // Use a map with id as key for performance and layer id as key
    const drawnGeoJSAnnotations: Map<string, IGeoJSAnnotation[]> = new Map();
    for (const geoJSAnnotation of this.annotationLayer.annotations()) {
      const id = geoJSAnnotation.options("girderId");
      if (id) {
        if (!drawnGeoJSAnnotations.has(id)) {
          drawnGeoJSAnnotations.set(id, []);
        }
        drawnGeoJSAnnotations.get(id)!.push(geoJSAnnotation);
      }
    }

    // Then draw the new annotations
    this.drawNewAnnotations(drawnGeoJSAnnotations);
    if (this.shouldDrawConnections) {
      this.drawNewConnections(drawnGeoJSAnnotations);
    }
    this.annotationLayer.draw();
  }

  drawTooltips() {
    this.textLayer.features().forEach((feature: any) => {
      this.textLayer.deleteFeature(feature);
    });

    if (this.showTooltips) {
      // One text feature per line as in https://opengeoscience.github.io/geojs/tutorials/text/
      // Centroid is computed once per new line (optimization needed?)
      // TODO: More performance with renderThreshold https://opengeoscience.github.io/geojs/apidocs/geo.textFeature.html#.styleSpec
      const anyImage = this.store.dataset?.anyImage();
      if (!anyImage) {
        return;
      }
      const unrolledCoordinates = this.unrolledCentroidCoordinates;
      const baseStyle = {
        fontSize: "12px",
        fontFamily: "sans-serif",
        textAlign: "center",
        textBaseline: "middle",
        color: "white",
        textStrokeColor: "black",
        textStrokeWidth: 3
      };
      let yOffset = 0;
      this.textLayer
        .createFeature("text")
        .data(this.displayedAnnotations)
        .position((annotation: IAnnotation) => {
          return unrolledCoordinates[annotation.id];
        })
        .style({
          text: (annotation: IAnnotation) => {
            const index = this.annotationStore.annotations.findIndex(
              (annotationCandidate: IAnnotation) =>
                annotationCandidate.id === annotation.id
            );
            return (
              "ID=" + index + " Tags:[ " + annotation.tags.join(", ") + " ]"
            );
          },
          offset: { x: 0, y: yOffset },
          ...baseStyle
        });
      yOffset += 12;
      for (const propertyId of this.toggledPropertiesId) {
        const property = this.properties.find(
          property => property.id === propertyId
        );
        if (property) {
          this.textLayer
            .createFeature("text")
            .data(this.displayedAnnotations)
            .position((annotation: IAnnotation) => {
              return unrolledCoordinates[annotation.id];
            })
            .style({
              text: (annotation: IAnnotation) => {
                let value =
                  this.propertyValues[annotation.id]?.[propertyId] || "unknown";
                return `${property.name}=${value}`;
              },
              offset: { x: 0, y: yOffset },
              ...baseStyle
            });
          yOffset += 12;
        }
      }
    }

    this.textLayer.draw();
  }

  get toggledPropertiesId() {
    return this.propertyStore.annotationListIds;
  }

  get properties() {
    return this.propertyStore.properties;
  }

  get propertyValues() {
    return this.propertyStore.propertyValues;
  }

  // Annotations that could be displayed by a layer
  get displayableAnnotations() {
    if (!this.annotationLayer || !this.shouldDrawAnnotations) {
      return [];
    }
    return this.store.filteredDraw
      ? this.filteredAnnotations
      : this.annotationStore.annotations;
  }

  get validLayers() {
    return this.layers.slice(
      this.lowestLayer,
      this.lowestLayer + this.layerCount
    );
  }

  get isLayerIdValid() {
    const validLayerIds: Set<string> = new Set();
    for (const layer of this.validLayers) {
      validLayerIds.add(layer.id);
    }
    return (id: string) => validLayerIds.has(id);
  }

  // A map: map<layer id, map<annotation id, annotation>>
  // It provides an easy way to get all the annotations visible from a layer or
  // to check if an annotation belongs to a layer
  get layerAnnotations() {
    // channel -> array of annotations
    const channelToAnnotationIds: Map<number, IAnnotation[]> = new Map();
    for (const annotation of this.displayableAnnotations) {
      if (!channelToAnnotationIds.has(annotation.channel)) {
        channelToAnnotationIds.set(annotation.channel, []);
      }
      channelToAnnotationIds.get(annotation.channel)!.push(annotation);
    }

    // layer id -> set of annotation ids
    const layerIdToAnnotationIds: Map<
      string,
      Map<string, IAnnotation>
    > = new Map();
    for (const layer of this.validLayers) {
      // Create a new set of annotation ids for this layer
      const annotationIdsSet: Map<string, IAnnotation> = new Map();
      layerIdToAnnotationIds.set(layer.id, annotationIdsSet);
      if (layer.visible) {
        // Get all annotations in the layer's channel
        const layerChannelAnnotations =
          channelToAnnotationIds.get(layer.channel) || [];
        const sliceIndexes = this.store.layerSliceIndexes(layer);
        for (const annotation of layerChannelAnnotations) {
          if (
            (this.store.unrollXY ||
              annotation.location.XY === sliceIndexes?.xyIndex) &&
            (this.store.unrollZ ||
              annotation.location.Z === sliceIndexes?.zIndex) &&
            (this.store.unrollT ||
              annotation.location.Time === sliceIndexes?.tIndex)
          ) {
            annotationIdsSet.set(annotation.id, annotation);
          }
        }
      }
    }
    return layerIdToAnnotationIds;
  }

  get layerDisplaysAnnotation() {
    return (layerId: string, annotationId: string) =>
      !!this.layerAnnotations.get(layerId)?.has(annotationId);
  }

  // A set of annotation ids
  get displayedAnnotationIds() {
    const totalAnnotationIdsSet: Set<string> = new Set();
    for (const layerAnnotationIdsSet of this.layerAnnotations.values()) {
      for (const annotationId of layerAnnotationIdsSet.keys()) {
        totalAnnotationIdsSet.add(annotationId);
      }
    }
    return totalAnnotationIdsSet;
  }

  // An array of annotations
  get displayedAnnotations() {
    const annotationList: IAnnotation[] = [];
    for (const layerAnnotationIdsSet of this.layerAnnotations.values()) {
      for (const annotation of layerAnnotationIdsSet.values()) {
        annotationList.push(annotation);
      }
    }
    return annotationList;
  }

  // Remove from the layer annotations that should no longer be renderered (index change, layer change...)
  clearOldAnnotations(clearAll = false, redraw = true) {
    this.annotationLayer
      .annotations()
      .forEach((geoJsAnnotation: IGeoJSAnnotation) => {
        if (geoJsAnnotation === this.annotationLayer.currentAnnotation) {
          // Don't do anything with currentAnnotation as it is used internally by geoJS
          return;
        }
        if (clearAll) {
          this.annotationLayer.removeAnnotation(geoJsAnnotation, false);
          this.annotationLayer.modified();
          return;
        }

        const {
          girderId,
          layerId,
          isConnection,
          childId,
          parentId
        } = geoJsAnnotation.options();

        if (!girderId) {
          return;
        }

        // Check for connections
        if (isConnection) {
          const parent = this.getAnnotationFromId(parentId);
          const child = this.getAnnotationFromId(childId);
          if (
            !this.shouldDrawConnections ||
            !parent ||
            !child ||
            !this.displayedAnnotationIds.has(parent.id) ||
            !this.displayedAnnotationIds.has(child.id)
          ) {
            this.annotationLayer.removeAnnotation(geoJsAnnotation, false);
            this.annotationLayer.modified();
          }
          return;
        }

        const annotation = this.getAnnotationFromId(girderId);
        const layer = this.store.getLayerFromId(layerId);
        if (
          layer &&
          annotation &&
          this.layerDisplaysAnnotation(layer.id, annotation.id)
        ) {
          return;
        }

        this.annotationLayer.removeAnnotation(geoJsAnnotation, false);
        this.annotationLayer.modified();
      });
    if (redraw) {
      this.annotationLayer.draw();
    }
  }

  // Add to the layer annotations that should be rendered and have not already been added.
  drawNewAnnotations(drawnGeoJSAnnotations: Map<string, IGeoJSAnnotation[]>) {
    for (const [layerId, annotationMap] of this.layerAnnotations) {
      const layer = this.store.getLayerFromId(layerId);
      if (layer?.visible) {
        for (const [annotationId, annotation] of annotationMap) {
          const excluded = drawnGeoJSAnnotations
            .get(annotationId)
            ?.some(
              geoJSAnnotation => geoJSAnnotation.options("layerId") === layer.id
            );
          if (!excluded) {
            const geoJSAnnotation = this.createGeoJSAnnotation(
              annotation,
              layerId
            );
            if (geoJSAnnotation) {
              this.annotationLayer.addAnnotation(
                geoJSAnnotation,
                undefined,
                false
              );
            }
          }
        }
      }
    }
    for (const [annotationId, geoJSAnnotationList] of drawnGeoJSAnnotations) {
      const isHoveredGT = annotationId === this.hoveredAnnotationId;
      const isSelectedGT = this.isAnnotationSelected(annotationId);
      for (const geoJSAnnotation of geoJSAnnotationList) {
        const {
          layerId,
          isHovered,
          isSelected,
          style
        } = geoJSAnnotation.options();
        // If hover or select changed, update style
        if (isHovered != isHoveredGT || isSelected != isSelectedGT) {
          const layer = this.store.getLayerFromId(layerId);
          const newStyle = this.getAnnotationStyle(annotationId, layer?.color);
          geoJSAnnotation.options("style", { ...style, ...newStyle });
          geoJSAnnotation.options("isHovered", isHoveredGT);
          geoJSAnnotation.options("isSelected", isSelectedGT);
        }
      }
    }
  }

  drawNewConnections(drawnGeoJSAnnotations: Map<string, IGeoJSAnnotation[]>) {
    this.annotationConnections
      .filter(
        (connection: IAnnotationConnection) =>
          !drawnGeoJSAnnotations.has(connection.id) &&
          (this.displayedAnnotationIds.has(connection.parentId) ||
            this.displayedAnnotationIds.has(connection.childId))
      )
      .forEach((connection: IAnnotationConnection) => {
        {
          const childAnnotation = this.getAnnotationFromId(connection.childId);
          const parentAnnotation = this.getAnnotationFromId(
            connection.parentId
          );
          if (
            !childAnnotation ||
            !parentAnnotation ||
            !this.displayedAnnotationIds.has(childAnnotation.id) ||
            !this.displayedAnnotationIds.has(parentAnnotation.id)
          ) {
            return;
          }
          this.drawGeoJSAnnotationFromConnection(
            connection,
            childAnnotation,
            parentAnnotation
          );
        }
      });
  }

  createGeoJSAnnotation(annotation: IAnnotation, layerId: string | undefined) {
    if (!this.store.dataset) {
      return null;
    }

    const anyImage = this.store.dataset?.anyImage();
    if (!anyImage) {
      return null;
    }
    const girderOptions = {
      girderId: annotation.id,
      isHovered: annotation.id === this.hoveredAnnotationId,
      location: annotation.location,
      channel: annotation.channel,
      isSelected: false,
      layerId
    };

    const coordinates = this.unrolledCoordinates(
      annotation.coordinates,
      annotation.location,
      anyImage
    );

    const newGeoJSAnnotation = geojsAnnotationFactory(
      annotation.shape,
      coordinates,
      girderOptions
    );
    if (!newGeoJSAnnotation) {
      return null;
    }

    newGeoJSAnnotation.options("girderId", annotation.id);

    if (annotation.id === this.hoveredAnnotationId) {
      newGeoJSAnnotation.options("isHovered", true);
    }

    if (this.isAnnotationSelected(annotation.id)) {
      newGeoJSAnnotation.options("isSelected", true);
    }

    const style = newGeoJSAnnotation.options("style");
    const layer = this.store.getLayerFromId(layerId);
    const newStyle = this.getAnnotationStyle(annotation.id, layer?.color);
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
    const pA = this.unrolledCentroidCoordinates[child.id];
    const pB = this.unrolledCentroidCoordinates[parent.id];
    const line = geojs.annotation.lineAnnotation();
    line.options("vertices", [pA, pB]);
    line.options("isConnection", true);
    line.options("childId", connection.childId);
    line.options("parentId", connection.parentId);
    line.options("girderId", connection.id);
    this.annotationLayer.addAnnotation(line, undefined, false);
  }

  private getAnnotationLocationFromTool(tool: IToolConfiguration) {
    return this.annotationStore.getAnnotationLocationFromTool(tool);
  }

  private async createAnnotationFromTool(
    coordinates: IGeoJSPoint[],
    tool: IToolConfiguration
  ) {
    if (!coordinates || !coordinates.length || !this.dataset) {
      return null;
    }

    const { location, channel } = await this.getAnnotationLocationFromTool(
      tool
    );

    // Create the new annotation
    const toolAnnotation = tool.values.annotation;
    const newAnnotation: IAnnotation | null = await this.annotationStore.createAnnotation(
      {
        tags: toolAnnotation.tags,
        shape: toolAnnotation.shape,
        channel,
        location,
        coordinates,
        datasetId: this.dataset.id
      }
    );
    return newAnnotation;
  }

  private shouldSelectAnnotation(
    selectionAnnotationType: AnnotationShape,
    selectionAnnotationCoordinates: any[],
    annotation: IAnnotation,
    annotationStyle: any,
    unitsPerPixel: number
  ) {
    const annotationCoordinates = annotation.coordinates;

    if (selectionAnnotationType === AnnotationShape.Point) {
      // If the selection annotation type is "Point"
      // Case 1: Annotation to test is a "Point":
      // The distance point to point should be lower than the annotation radius
      // Case 2: Annotation to test is a "Line":
      // The distance between the line and the point should be lower than the lineAnnotation width
      // Case 3: Annotation to test is "Polygon":
      // Check if the selection point is positioned into the Polygon.

      const selectionPosition = selectionAnnotationCoordinates[0];
      const { radius, strokeWidth } = annotationStyle;

      if (annotation.shape === AnnotationShape.Point) {
        const annotationRadius = (radius + strokeWidth) * unitsPerPixel;
        const annotationPosition = annotationCoordinates[0];
        return (
          pointDistance(selectionPosition, annotationPosition) <
          annotationRadius
        );
      } else if (annotation.shape === AnnotationShape.Line) {
        // Check if click on points of the line, or on the line directly
        const width = strokeWidth * unitsPerPixel;
        return annotationCoordinates.reduce(
          (isIn: boolean, point: any, index: number) => {
            let isPointInLine = false;
            if (index === annotationCoordinates.length - 1) {
              // Specific case for the last point that does not have a next point
              isPointInLine = pointDistance(point, selectionPosition) < width;
            } else {
              isPointInLine =
                geojs.util.distance2dToLineSquared(
                  selectionPosition,
                  point,
                  annotationCoordinates[index + 1]
                ) < width;
            }
            return isIn || isPointInLine;
          },
          false
        );
      } else {
        return geojs.util.pointInPolygon(
          selectionPosition,
          annotationCoordinates
        );
      }
    } else {
      // If the selection annotation type is "Polygon"
      // Check if the tested annotation (independently from its type)
      // is in the defined polygon
      return annotation.coordinates.some((point: any) => {
        return geojs.util.pointInPolygon(point, selectionAnnotationCoordinates);
      });
    }
  }

  private async selectAnnotations(selectAnnotation: any) {
    if (!selectAnnotation) {
      return;
    }

    const coordinates = selectAnnotation.coordinates();
    const type = selectAnnotation.type();

    // Get general information from the map.
    // When working with pointAnnotation, unitsPerPixels is necessary to
    // compute the right value of the radius.
    const unitsPerPixel = this.getMapUnitsPerPixel();

    // Get selected annotations.
    const selectedAnnotations: IAnnotation[] = this.annotationLayer
      .annotations()
      .reduce(
        (
          selectedAnnotations: IAnnotation[],
          geoJSannotation: IGeoJSAnnotation
        ) => {
          const { girderId, isConnection } = geoJSannotation.options();
          if (
            !girderId ||
            isConnection ||
            selectedAnnotations.some(
              selectedAnnotation => selectedAnnotation.id === girderId
            )
          ) {
            return selectedAnnotations;
          }
          const annotation = this.getAnnotationFromId(girderId);
          if (
            !annotation ||
            !this.shouldSelectAnnotation(
              type,
              coordinates,
              annotation,
              geoJSannotation.style(),
              unitsPerPixel
            )
          ) {
            return selectedAnnotations;
          }
          return [...selectedAnnotations, annotation];
        },
        []
      );

    // Update annotation store
    switch (this.annotationSelectionType) {
      case AnnotationSelectionTypes.ADD:
        this.annotationStore.selectAnnotations(selectedAnnotations);
        break;
      case AnnotationSelectionTypes.REMOVE:
        this.annotationStore.unselectAnnotations(selectedAnnotations);
        break;
      case AnnotationSelectionTypes.TOGGLE:
        this.annotationStore.toggleSelected(selectedAnnotations);
    }

    // Remove the selection annotation from layer (do not show the annotation used to select)
    this.annotationLayer.removeAnnotation(selectAnnotation);
  }

  private async addAnnotationFromGeoJsAnnotation(annotation: any) {
    if (!annotation || !this.selectedTool) {
      return;
    }

    // Create the new annotation
    const newAnnotation: IAnnotation | null = await this.createAnnotationFromTool(
      annotation.coordinates(),
      this.selectedTool
    );

    if (!newAnnotation) {
      return;
    }
    const layerNumber = this.selectedTool?.values?.annotation
      ?.coordinateAssignments?.layer;
    const layerId =
      typeof layerNumber !== "number" ? this.layers[layerNumber].id : undefined;

    this.addAnnotation(newAnnotation, layerId);
    this.annotationLayer.removeAnnotation(annotation);
  }

  private async addAnnotationConnections(
    annotation: IAnnotation
  ): Promise<IAnnotationConnection[]> {
    if (!this.selectedTool || !this.dataset) {
      return [];
    }
    const connectTo = this.selectedTool.values.connectTo;
    // Look for connections
    if (connectTo && connectTo.tags && connectTo.tags.length) {
      // Find eligible annotations (matching tags and channel)
      const connectToChannel =
        connectTo.layer === null ? null : this.layers[connectTo.layer].channel;
      const connections = await this.annotationStore.createConnections({
        annotationsIds: [annotation.id],
        tags: this.selectedTool.values.connectTo.tags,
        channelId: connectToChannel
      });
      if (connections) {
        connections.forEach((connection: any) => {
          this.annotationStore.addConnection(connection);
        });

        return connections;
      }
    }
    return [];
  }

  addAnnotation(newAnnotation: IAnnotation, layerId: string | undefined) {
    // Save the new annotation
    this.annotationStore.addAnnotation(newAnnotation);

    this.addAnnotationConnections(newAnnotation);

    // Display the new annotation
    const newGeoJSAnnotation = this.createGeoJSAnnotation(
      newAnnotation,
      layerId
    );
    this.annotationLayer.addAnnotation(newGeoJSAnnotation);
  }

  async addAnnotationFromSnapping(annotation: any) {
    if (!annotation || this.maps.length !== 1) {
      return;
    }
    const mapentry = this.maps[0];
    const coordinates = annotation.coordinates();
    this.annotationLayer.removeAnnotation(annotation);
    if (!this.selectedTool) {
      return;
    }
    const location = this.selectedTool.values.annotation.coordinateAssignments;
    if (!location) {
      logError("Invalid snapping tool, annotation was not configured properly");
      return;
    }
    const layer = location.layer;
    const layerImage = mapentry.imageLayers[layer * 2];
    if (!layerImage) {
      return;
    }
    // Capture a screenshot of the layer
    const imageUrl: string = await mapentry.map.screenshot(layerImage);
    // Convert the screenshot data-uri to an array
    const response: Response = await fetch(imageUrl);
    const blob: Blob = await response.blob();
    const array = new Uint8Array(await blob.arrayBuffer());
    // Compute snapped coordinates
    const snappedCoordinates = await snapCoordinates(
      coordinates,
      array,
      this.selectedTool,
      mapentry.map
    );
    if (!snappedCoordinates || !snappedCoordinates.length) {
      logError("Failed to compute new coordinates for the snapping tool");
      return;
    }
    // Create the new annotation
    const newAnnotation: IAnnotation | null = await this.createAnnotationFromTool(
      snappedCoordinates,
      this.selectedTool
    );
    if (!newAnnotation) {
      return;
    }
    this.addAnnotation(newAnnotation, location.layer);
  }

  handleNewROIFilter(geojsAnnotation: any) {
    if (!this.roiFilter) {
      return;
    }
    const id = this.roiFilter.id;
    this.filterStore.validateNewROIFilter(geojsAnnotation.coordinates());
    this.annotationLayer.removeAnnotation(geojsAnnotation);
  }

  get selectedToolRadius() {
    return this.selectedTool?.values?.radius;
  }

  cursorAnnotation: any = null;
  lastCursorPosition: { x: number; y: number } = { x: 0, y: 0 };

  @Watch("selectedToolRadius")
  updateCursorAnnotation(evt?: any) {
    if (
      !this.selectedTool ||
      !this.cursorAnnotation ||
      !this.selectedToolRadius ||
      !this.maps
    ) {
      return false;
    }
    const map = this.maps[0].map;
    const basePositionGCS = evt?.mapgcs ? evt.mapgcs : this.lastCursorPosition;
    this.lastCursorPosition = basePositionGCS;
    const basePositionDisplay = map.gcsToDisplay(basePositionGCS);
    this.cursorAnnotation._coordinates(
      [
        {
          x: basePositionDisplay.x - this.selectedToolRadius,
          y: basePositionDisplay.y - this.selectedToolRadius
        },
        {
          x: basePositionDisplay.x + this.selectedToolRadius,
          y: basePositionDisplay.y - this.selectedToolRadius
        },
        {
          x: basePositionDisplay.x + this.selectedToolRadius,
          y: basePositionDisplay.y + this.selectedToolRadius
        },
        {
          x: basePositionDisplay.x - this.selectedToolRadius,
          y: basePositionDisplay.y + this.selectedToolRadius
        }
      ].map(map.displayToGcs)
    );
    this.cursorAnnotation.draw();
    return true;
  }

  addCursorAnnotation() {
    if (this.cursorAnnotation) {
      return;
    }
    this.cursorAnnotation = geojs.createAnnotation("circle");
    this.cursorAnnotation.layer(this.annotationLayer);
    this.annotationLayer.addAnnotation(this.cursorAnnotation);
    this.annotationLayer.geoOn(
      geojs.event.mousemove,
      this.updateCursorAnnotation
    );
    this.annotationLayer.geoOn(geojs.event.zoom, this.updateCursorAnnotation);
    this.cursorAnnotation.style({
      fill: true,
      fillColor: "white",
      fillOpacity: 0.2,
      strokeWidth: 3,
      strokeColor: "black"
    });
    this.updateCursorAnnotation();
  }

  removeCursorAnnotation() {
    if (!this.cursorAnnotation) {
      return;
    }
    this.annotationLayer.removeAnnotation(this.cursorAnnotation);
    this.annotationLayer.geoOff(
      geojs.event.mousemove,
      this.updateCursorAnnotation
    );
    this.annotationLayer.geoOff(geojs.event.zoom, this.updateCursorAnnotation);
    this.cursorAnnotation = null;
  }

  refreshAnnotationMode() {
    this.removeCursorAnnotation();
    if (this.unrolling) {
      this.annotationLayer.mode(null);
      return;
    }

    if (this.roiFilter) {
      if (this.selectedTool) {
        this.toolsStore.setSelectedToolId(null);
      }
      this.annotationLayer.mode("polygon");
      return;
    }

    switch (this.selectedTool?.type) {
      case "create":
        const annotation = this.selectedTool.values.annotation;
        this.annotationLayer.mode(annotation?.shape);
        break;
      case "snap":
        if (this.selectedTool.values.snapTo.value === "circleToDot") {
          this.addCursorAnnotation();
          this.annotationLayer.mode("point");
        } else {
          this.annotationLayer.mode("polygon");
        }
        break;
      case "segmentation":
        // TODO: tool asks for ROI, change layer mode and trigger computation afterwards
        // TODO: otherwise, trigger computation here
        // TODO: when computation is triggered, toggle a bool that enables a v-menu
        // TODO: for now with just a compute button, but later previews, custom forms served from the started worker ?
        break;
      case "select":
        const selectionType =
          this.selectedTool.values.selectionType.value === "pointer"
            ? "point"
            : "polygon";
        this.annotationLayer.mode(selectionType);
        break;
      case null:
      case undefined:
        this.annotationLayer.mode(null);
        break;
      default:
        logWarning(`${this.selectedTool?.type} tools are not supported yet`);
        this.annotationLayer.mode(null);
    }
  }

  handleModeChange(evt: any) {
    if (evt.mode === null) {
      this.refreshAnnotationMode();
    }
  }

  setHoveredAnnotationFromCoordinates(gcsCoordinates: IGeoJSPoint) {
    const hasSet = this.annotationLayer
      .annotations()
      .some((geoJSAnnotation: any) => {
        const id = geoJSAnnotation.options("girderId");
        if (!id) {
          return false;
        }
        const annotation = this.getAnnotationFromId(id);
        if (!annotation) {
          return false;
        }
        const unitsPerPixel = this.getMapUnitsPerPixel();
        if (
          this.shouldSelectAnnotation(
            AnnotationShape.Point,
            [gcsCoordinates],
            annotation,
            geoJSAnnotation.style(),
            unitsPerPixel
          )
        ) {
          if (this.annotationStore.hoveredAnnotationId === id) {
            this.annotationStore.setHoveredAnnotationId(null);
          } else {
            this.annotationStore.setHoveredAnnotationId(id);
          }
          return true;
        } else {
          return false;
        }
      });
    if (!hasSet) {
      this.annotationStore.setHoveredAnnotationId(null);
    }
  }

  private getMapUnitsPerPixel(): number {
    const map = this.annotationLayer.map();
    return map.unitsPerPixel(map.zoom());
  }

  handleAnnotationChange(evt: any) {
    if (!this.selectedTool && !this.roiFilter) {
      return;
    }

    switch (evt.event) {
      case "geo_annotation_state":
        if (this.selectedTool) {
          switch (this.selectedTool.type) {
            case "create":
              this.addAnnotationFromGeoJsAnnotation(evt.annotation);
              break;
            case "snap":
              this.addAnnotationFromSnapping(evt.annotation);
              break;
            case "select":
              this.selectAnnotations(evt.annotation);
              break;
          }
        } else if (evt.annotation) {
          this.handleNewROIFilter(evt.annotation);
        }
        break;
      default:
        break;
    }
  }

  @Watch("displayedAnnotations")
  @Watch("annotationConnections")
  @Watch("xy")
  @Watch("z")
  @Watch("time")
  @Watch("hoveredAnnotationId")
  @Watch("selectedAnnotations")
  @Watch("shouldDrawAnnotations")
  @Watch("shouldDrawConnections")
  onRedrawNeeded() {
    this.drawAnnotationsAndTooltips();
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

  @Watch("showTooltips")
  @Watch("filteredAnnotationTooltips")
  @Watch("filteredAnnotations")
  @Watch("properties")
  @Watch("propertyValues")
  @Watch("toggledPropertiesId")
  onDrawTooltipsChanged() {
    this.drawTooltips();
  }

  @Watch("unrollH")
  @Watch("unrollW")
  onUnrollChanged() {
    this.clearOldAnnotations(true);
    this.drawAnnotationsAndTooltips();
  }

  @Watch("selectedTool")
  watchTool() {
    this.refreshAnnotationMode();
  }

  @Watch("roiFilter")
  watchFilter() {
    if (this.roiFilter) {
      this.refreshAnnotationMode();
    }
  }

  @Watch("enabledRoiFilters")
  drawRoiFilters() {
    this.annotationLayer
      .annotations()
      .filter((annotation: IGeoJSAnnotation) =>
        annotation.options("isRoiFilter")
      )
      .forEach((annotation: IGeoJSAnnotation) => {
        this.annotationLayer.removeAnnotation(annotation);
      });
    this.enabledRoiFilters.forEach((filter: IROIAnnotationFilter) => {
      const newGeoJSAnnotation = geojsAnnotationFactory("polygon", filter.roi, {
        id: filter.id,
        isRoiFilter: true
      });

      if (!newGeoJSAnnotation) {
        return;
      }

      newGeoJSAnnotation.style({
        fill: false,
        strokeWidth: 3,
        strokeColor: "black"
      });
      this.annotationLayer.addAnnotation(newGeoJSAnnotation);
    });
  }

  @Watch("annotationLayer")
  bind() {
    this.annotationLayer.geoOn(
      geojs.event.annotation.mode,
      this.handleModeChange
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.mode,
      this.handleAnnotationChange
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
    this.drawAnnotationsAndTooltips();
  }

  mounted() {
    this.fetchAnnotations();
    this.bind();

    this.propertyStore.fetchProperties();
    this.propertyStore.fetchPropertyValues();
    this.filterStore.updateHistograms();

    this.annotationLayer.geoOn(geojs.event.mouseclick, (evt: any) => {
      if (this.selectedTool === null && evt?.geo) {
        this.setHoveredAnnotationFromCoordinates(evt.geo);
      }
    });
  }

  // Mousetrap bindings
  mousetrapAnnotations = [
    {
      bind: "a",
      handler: () => {
        this.store.setDrawAnnotations(!this.store.drawAnnotations);
      }
    },
    {
      bind: "t",
      handler: () => {
        this.store.setShowTooltips(!this.store.showTooltips);
      }
    }
  ];
}
</script>

<style lang="scss" scoped></style>
