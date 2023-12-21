<template>
  <div></div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertiesStore from "@/store/properties";
import filterStore from "@/store/filters";

import geojs from "geojs";
import { snapCoordinates } from "@/utils/itk";

import { throttle, debounce } from "lodash-es";
const THROTTLE = 100;

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
  IGeoJSAnnotation,
  IRestrictTagsAndLayer,
  IMapEntry,
  IGeoJSMap
} from "../store/model";

import { logError, logWarning } from "@/utils/log";

import {
  pointDistance,
  getAnnotationStyleFromLayer,
  unrollIndexFromImages,
  geojsAnnotationFactory,
  tagFilterFunction
} from "@/utils/annotation";
import { getValueFromObjectAndPath } from "@/utils/paths";

function filterAnnotations(
  annotations: IAnnotation[],
  { tags, tagsInclusive, layerId }: IRestrictTagsAndLayer
) {
  let output = annotations.filter(annotation =>
    tagFilterFunction(annotation.tags, tags, !tagsInclusive)
  );
  // layerId === null <==> any layer
  if (layerId !== null) {
    const layer = store.getLayerFromId(layerId);
    if (layer) {
      const parentChannel = layer.channel;
      output = output.filter(
        annotation => annotation.channel === parentChannel
      );
    }
  }
  return output;
}

// Draws annotations on the given layer, and provides functionnality for the user selected tool.
@Component({ components: {} })
export default class AnnotationViewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
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
  readonly map!: IGeoJSMap;

  @Prop()
  readonly selectionPath!: IGeoJSPoint[];

  @Prop()
  readonly annotationLayer: any;

  @Prop()
  readonly textLayer: any;

  @Prop()
  readonly workerPreviewFeature: any;

  @Prop()
  readonly unrollH!: number;

  @Prop()
  readonly unrollW!: number;

  @Prop({ default: [] })
  readonly maps!: IMapEntry[];

  @Prop()
  readonly tileWidth!: number;

  @Prop()
  readonly tileHeight!: number;

  @Prop()
  readonly lowestLayer!: number;

  @Prop()
  readonly layerCount!: number;

  get displayWorkerPreview() {
    return this.propertyStore.displayWorkerPreview;
  }

  get configuration() {
    return this.store.configuration;
  }

  get layers() {
    return this.store.layers;
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

  get valueOnHover() {
    return this.store.valueOnHover;
  }

  get isAnnotationSelected() {
    return this.annotationStore.isAnnotationSelected;
  }

  selectionAnnotation: IGeoJSAnnotation | null = null;

  @Watch("selectionPath")
  updateSelection() {
    if (this.selectionPath.length === 0) {
      if (this.selectionAnnotation) {
        // Selection ended
        const coordinates = this.selectionAnnotation.coordinates();
        this.annotationLayer.removeAnnotation(this.selectionAnnotation);
        this.selectionAnnotation = null;
        // Select the annotations using a point or a polygon annotation
        let annotation;
        if (
          coordinates.length >= 1 &&
          coordinates.every(
            point =>
              point.x === coordinates[0].x && point.y === coordinates[0].y
          )
        ) {
          annotation = geojs.annotation.pointAnnotation();
          annotation!.options("position", coordinates[0]);
        } else {
          annotation = geojs.annotation.polygonAnnotation();
          annotation!.options("vertices", coordinates);
        }
        this.selectAnnotations(annotation);
      }
    } else {
      // Update the selection annotation
      if (!this.selectionAnnotation) {
        this.selectionAnnotation = geojs.annotation.lineAnnotation({
          style: {
            strokeColor: "white",
            strokeOpacity: 0.5,
            strokeWidth: 2,
            closed: true
          }
        });
      }
      this.annotationLayer.removeAnnotation(this.selectionAnnotation);
      this.selectionAnnotation!.options("vertices", this.selectionPath);
      this.annotationLayer.addAnnotation(this.selectionAnnotation);
    }
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
    return this.store.selectedTool;
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

  get baseStyle() {
    return {
      scaled: this.store.scaleAnnotationsWithZoom ? false : 1,
      radius: this.store.annotationsRadius
    };
  }

  getAnnotationStyle(annotationId: string, layerColor: string | undefined) {
    const hovered = annotationId === this.hoveredAnnotationId;
    const selected = this.isAnnotationSelected(annotationId);
    const baseStyle = this.baseStyle;
    return getAnnotationStyleFromLayer(
      layerColor,
      hovered,
      selected,
      baseStyle
    );
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

  drawAnnotations = throttle(this.drawAnnotationsNoThrottle, THROTTLE).bind(
    this
  );
  drawAnnotationsNoThrottle() {
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

  drawTooltips = throttle(this.drawTooltipsNoThrottle, THROTTLE).bind(this);
  drawTooltipsNoThrottle() {
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
        textStrokeWidth: 2
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
            const index = this.annotationStore.annotationIdToIdx[annotation.id];
            return index + ": " + annotation.tags.join(", ");
          },
          offset: { x: 0, y: yOffset },
          ...baseStyle
        });
      yOffset += 12;
      for (const propertyPath of this.displayedPropertyPaths) {
        const fullName = this.propertyStore.getSubIdsNameFromPath(propertyPath);
        if (fullName) {
          const propertyValues = this.propertyValues;
          const propertyData: Map<string, string> = new Map();
          const filteredIds: string[] = [];
          for (const annotation of this.displayedAnnotations) {
            const value = getValueFromObjectAndPath(
              propertyValues[annotation.id],
              propertyPath
            );
            if (typeof value !== "number") {
              continue;
            }
            const fixedValue = value.toFixed(2);
            const fixedError = Math.abs(value - parseFloat(fixedValue));
            const precisedValue = value.toPrecision(3);
            const precisedError = Math.abs(value - parseFloat(precisedValue));
            const stringValue =
              fixedError <= precisedError ? fixedValue : precisedValue;
            propertyData.set(annotation.id, stringValue);
            filteredIds.push(annotation.id);
          }
          this.textLayer
            .createFeature("text")
            .data(filteredIds)
            .position(
              (annotationId: string) => unrolledCoordinates[annotationId]
            )
            .style({
              // This is the part where we display the property value.
              // Right now, one issue is that if you have multiple properties to show and
              // one of them isn't defined for an annotation, the yOffset will be wrong.
              // That could be fixed by looping through the annotations independently, but I'm
              // worried that that would create performance issues, so leaving it as is for now.
              text: (annotationId: string) =>
                `${fullName}=${propertyData.get(annotationId)}`,
              offset: { x: 0, y: yOffset },
              ...baseStyle
            });
          yOffset += 12;
        }
      }
    }

    this.textLayer.draw();
  }

  get displayedPropertyPaths() {
    return this.propertyStore.displayedPropertyPaths;
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
        const allXY = this.store.unrollXY || layer.xy.type === "max-merge";
        const allZ = this.store.unrollZ || layer.z.type === "max-merge";
        const allT = this.store.unrollT || layer.time.type === "max-merge";
        for (const annotation of layerChannelAnnotations) {
          if (
            (allXY || annotation.location.XY === sliceIndexes?.xyIndex) &&
            (allZ || annotation.location.Z === sliceIndexes?.zIndex) &&
            (allT || annotation.location.Time === sliceIndexes?.tIndex)
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

  get connectionIdsSet() {
    const result: Set<string> = new Set();
    this.annotationConnections.forEach(({ id }) => result.add(id));
    return result;
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
            !this.connectionIdsSet.has(girderId) ||
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

  private restyleAnnotations() {
    for (const geoJSAnnotation of this.annotationLayer.annotations()) {
      const { girderId, layerId, style } = geoJSAnnotation.options();
      if (girderId) {
        const layer = this.store.getLayerFromId(layerId);
        const newStyle = this.getAnnotationStyle(girderId, layer?.color);
        geoJSAnnotation.options("style", Object.assign({}, style, newStyle));
      }
    }
    this.annotationLayer.draw();
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

  private getSelectedAnnotationsFromAnnotation(selectAnnotation: any) {
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
    return selectedAnnotations;
  }

  private selectAnnotations(selectAnnotation: any) {
    if (!selectAnnotation) {
      return;
    }
    const selectedAnnotations = this.getSelectedAnnotationsFromAnnotation(
      selectAnnotation
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

  private async handleAnnotationConnections(selectAnnotation: any) {
    const datasetId = this.dataset?.id;
    if (!selectAnnotation || !datasetId || !this.selectedTool) {
      return;
    }
    const selectedAnnotations = this.getSelectedAnnotationsFromAnnotation(
      selectAnnotation
    );

    const parentTemplate = this.selectedTool.values
      ?.parentAnnotation as IRestrictTagsAndLayer;
    const childTemplate = this.selectedTool.values
      ?.childAnnotation as IRestrictTagsAndLayer;
    if (!parentTemplate || !childTemplate) {
      return;
    }
    // Get all the parents and children
    const parents = filterAnnotations(selectedAnnotations, parentTemplate);
    const children = filterAnnotations(selectedAnnotations, childTemplate);
    const parentIds = parents.map(a => a.id);
    const childIds = children.map(a => a.id);

    if (this.selectedTool.values.action.value === "add") {
      // Add all connections between a parent and a child
      await this.annotationStore.createAllConnections({
        parentIds,
        childIds,
        label: this.selectedTool.name,
        tags: [...parentTemplate.tags, ...childTemplate.tags]
      });
    } else {
      // Delete any connection between a parent and a child
      await this.annotationStore.deleteAllConnections({
        parentIds,
        childIds
      });
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
    const layerId = this.selectedTool?.values?.annotation?.coordinateAssignments
      ?.layer;

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
        this.store.getLayerFromId(connectTo.layer)?.channel ?? null;
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
    const layerId = location.layer;
    const layerIndex = this.store.getLayerIndexFromId(layerId);
    if (layerIndex === null) {
      return;
    }
    const layerImage = mapentry.imageLayers[layerIndex * 2];
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
    this.filterStore.validateNewROIFilter(geojsAnnotation.coordinates());
    this.annotationLayer.removeAnnotation(geojsAnnotation);
  }

  get selectedToolRadius(): number | undefined {
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
    const map = this.map;
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
      ].map(point => map.displayToGcs(point))
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
        this.store.setSelectedToolId(null);
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
      case "connection":
        this.annotationLayer.mode("polygon");
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
    const geoAnnotations: IGeoJSAnnotation[] = this.annotationLayer.annotations();
    let annotationToToggle: IAnnotation | null = null;
    for (let i = 0; i < geoAnnotations.length; ++i) {
      const geoAnnotation = geoAnnotations[i];
      const id = geoAnnotation.options("girderId");
      if (!id) {
        continue;
      }
      const annotation = this.getAnnotationFromId(id);
      if (!annotation) {
        continue;
      }
      const unitsPerPixel = this.getMapUnitsPerPixel();
      const shouldSelect = this.shouldSelectAnnotation(
        AnnotationShape.Point,
        [gcsCoordinates],
        annotation,
        geoAnnotation.style(),
        unitsPerPixel
      );
      if (shouldSelect) {
        annotationToToggle = annotation;
        break;
      }
    }
    if (
      !annotationToToggle ||
      this.annotationStore.hoveredAnnotationId === annotationToToggle.id
    ) {
      this.annotationStore.setHoveredAnnotationId(null);
    } else {
      this.annotationStore.setHoveredAnnotationId(annotationToToggle.id);
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
            case "connection":
              this.handleAnnotationConnections(evt.annotation);
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

  @Watch("baseStyle")
  onRestyleNeeded() {
    this.restyleAnnotations();
  }

  @Watch("unrolling")
  toggleAnnotationModeWhenUnrolling() {
    this.refreshAnnotationMode();
  }

  @Watch("showTooltips")
  @Watch("filteredAnnotationTooltips")
  @Watch("filteredAnnotations")
  @Watch("properties")
  @Watch("propertyValues")
  @Watch("displayedPropertyPaths")
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

  @Watch("annotationLayer")
  @Watch("valueOnHover")
  updateValueOnHover() {
    this.store.setHoverValue(null);
    if (this.valueOnHover) {
      this.annotationLayer.geoOn(
        geojs.event.mousemove,
        this.handleValueOnMouseMove
      );
    } else {
      this.annotationLayer.geoOff(
        geojs.event.mousemove,
        this.handleValueOnMouseMove
      );
    }
  }

  handleValueOnMouseMove(e: any) {
    this.store.setHoverValue(null);
    this.handleValueOnMouseMoveDebounce(e);
  }

  handleValueOnMouseMoveDebounce = debounce(
    this.handleValueOnMouseMoveNoDebounce,
    100
  );
  async handleValueOnMouseMoveNoDebounce(e: any) {
    if (!this.dataset) {
      return;
    }
    const values: { [layerId: string]: number[] } = {};
    const promises: Promise<void>[] = [];
    for (const layer of this.validLayers) {
      if (layer.visible) {
        const image = this.store.getImagesFromLayer(layer)[0];
        if (image) {
          const setPromise = this.store.api
            .getPixelValue(image, e.geo.x, e.geo.y)
            .then(pixel => {
              if (pixel.value) {
                values[layer.id] = pixel.value;
              }
            });
          promises.push(setPromise);
        }
      }
    }
    await Promise.all(promises);
    if (Object.keys(values).length > 0) {
      this.store.setHoverValue(values);
    }
  }

  mounted() {
    this.bind();
    this.updateValueOnHover();

    this.filterStore.updateHistograms();

    this.addHoverCallback();
  }

  @Watch("annotationLayer")
  addHoverCallback() {
    this.annotationLayer.geoOn(geojs.event.mouseclick, (evt: any) => {
      if (this.selectedTool === null && evt?.geo) {
        this.setHoveredAnnotationFromCoordinates(evt.geo);
      }
    });
  }
}
</script>

<style lang="scss" scoped></style>
