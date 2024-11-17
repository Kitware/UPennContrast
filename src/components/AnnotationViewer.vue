<template>
  <div>
    <annotation-context-menu
      :show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :annotation="rightClickedAnnotation"
      @save="handleContextMenuSave"
      @cancel="handleContextMenuCancel"
    />
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertiesStore from "@/store/properties";
import filterStore from "@/store/filters";

import geojs from "geojs";
import { snapCoordinates } from "@/utils/itk";

import { throttle, debounce } from "lodash";
const THROTTLE = 100;

import {
  AnnotationSelectionTypes,
  AnnotationShape,
  IAnnotation,
  IAnnotationConnection,
  IAnnotationLocation,
  IDisplayLayer,
  IGeoJSAnnotation,
  IGeoJSAnnotationLayer,
  IGeoJSFeature,
  IGeoJSFeatureLayer,
  IGeoJSLineFeatureStyle,
  IGeoJSMap,
  IGeoJSPosition,
  IGeoJSPointFeatureStyle,
  IGeoJSPolygonFeatureStyle,
  IImage,
  IMapEntry,
  IMouseState,
  IRestrictTagsAndLayer,
  IROIAnnotationFilter,
  ISamAnnotationToolState,
  IToolConfiguration,
  SamAnnotationToolStateSymbol,
  TSamPrompt,
  TToolState,
  ConnectionToolStateSymbol,
  IGeoJSMouseState,
} from "../store/model";

import { logError, logWarning } from "@/utils/log";

import {
  pointDistance,
  getAnnotationStyleFromBaseStyle,
  unrollIndexFromImages,
  geojsAnnotationFactory,
  tagFilterFunction,
} from "@/utils/annotation";
import { getStringFromPropertiesAndPath } from "@/utils/paths";
import {
  mouseStateToSamPrompt,
  samPromptToAnnotation,
} from "@/pipelines/samPipeline";
import { NoOutput } from "@/pipelines/computePipeline";

import ColorPickerMenu from "@/components/ColorPickerMenu.vue";
import AnnotationContextMenu from "@/components/AnnotationContextMenu.vue";

function filterAnnotations(
  annotations: IAnnotation[],
  { tags, tagsInclusive, layerId }: IRestrictTagsAndLayer,
) {
  let output = annotations.filter((annotation) =>
    tagFilterFunction(annotation.tags, tags, !tagsInclusive),
  );
  // layerId === null <==> any layer
  if (layerId !== null) {
    const layer = store.getLayerFromId(layerId);
    if (layer) {
      const parentChannel = layer.channel;
      output = output.filter(
        (annotation) => annotation.channel === parentChannel,
      );
    }
  }
  return output;
}

// Draws annotations on the given layer, and provides functionnality for the user selected tool.
@Component({
  components: { ColorPickerMenu, AnnotationContextMenu },
})
export default class AnnotationViewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertiesStore;
  readonly filterStore = filterStore;

  // Compute the centroid of each annotation, taking unrolling into account
  get unrolledCentroidCoordinates() {
    const centroidMap: { [annotationId: string]: IGeoJSPosition } = {};
    const annotationCentroids = this.annotationStore.annotationCentroids;

    const anyImage = this.store.dataset?.anyImage();
    if (anyImage) {
      for (const annotation of this.annotationStore.annotations) {
        const centroid = annotationCentroids[annotation.id];
        const unrolledCentroid = this.unrolledCoordinates(
          [centroid],
          annotation.location,
          anyImage,
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
      (filter: IROIAnnotationFilter) => filter.enabled,
    );
  }

  @Prop()
  readonly map!: IGeoJSMap;

  @Prop()
  readonly capturedMouseState!: IMouseState | null;

  @Prop()
  readonly annotationLayer!: IGeoJSAnnotationLayer;

  @Prop()
  readonly textLayer!: IGeoJSFeatureLayer;

  @Prop()
  readonly workerPreviewFeature!: IGeoJSFeature;

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
    return this.selectedToolConfiguration?.values?.image?.image;
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

  get showAnnotationsFromHiddenLayers(): boolean {
    return this.store.showAnnotationsFromHiddenLayers;
  }

  // Special annotations

  // This annotation has not been submited yet
  pendingAnnotation: IGeoJSAnnotation | null = null;
  // This annotations comes from the mouse state preview
  selectionAnnotation: IGeoJSAnnotation | null = null;
  // These annotations represents the prompts of the user
  samPromptAnnotations: IGeoJSAnnotation[] = [];
  // User clicked to get this annotation when not in turbo mode
  samUnsubmittedAnnotation: IGeoJSAnnotation | null = null;
  // This is the annotation that is shown as a "what if the user clicks here"
  samLivePreviewAnnotation: IGeoJSAnnotation | null = null;

  get selectedToolConfiguration(): IToolConfiguration | null {
    return this.store.selectedTool?.configuration ?? null;
  }

  get selectedToolState(): TToolState | null {
    return this.store.selectedTool?.state ?? null;
  }

  get samToolState(): ISamAnnotationToolState | null {
    const state = this.selectedToolState;
    if (!(state?.type === SamAnnotationToolStateSymbol)) {
      return null;
    }
    const samMapEntry = state.nodes.input.geoJSMap.output;
    if (samMapEntry === NoOutput || samMapEntry.map !== this.map) {
      return null;
    }
    return state;
  }

  get samPrompts(): TSamPrompt[] {
    const prompts = this.samToolState?.nodes.input.mainPrompt.output;
    return prompts === undefined || prompts === NoOutput ? [] : prompts;
  }

  get toolHighlightedAnnotationIds(): Set<string> {
    const state = this.selectedToolState;
    if (
      state?.type === ConnectionToolStateSymbol &&
      state.selectedAnnotationId
    ) {
      return new Set([state.selectedAnnotationId]);
    }
    return new Set();
  }

  get pendingStoreAnnotation(): IAnnotation | null {
    return this.annotationStore.pendingAnnotation;
  }

  @Watch("pendingStoreAnnotation")
  pendingAnnotationChanged() {
    if (this.pendingAnnotation) {
      this.annotationLayer.removeAnnotation(this.pendingAnnotation);
      this.pendingAnnotation = null;
    }
    if (this.pendingStoreAnnotation) {
      this.pendingAnnotation = this.createGeoJSAnnotation(
        this.pendingStoreAnnotation,
      );
    }
    if (this.pendingAnnotation) {
      this.pendingAnnotation.options("specialAnnotation", true);
      this.annotationLayer.addAnnotation(this.pendingAnnotation);
    }
  }

  get samMainOutput() {
    return this.samToolState?.output ?? null;
  }

  @Watch("samMainOutput")
  onSamMainOutputChanged() {
    // Remove previous annotation
    if (this.samUnsubmittedAnnotation) {
      this.annotationLayer.removeAnnotation(this.samUnsubmittedAnnotation);
      this.samUnsubmittedAnnotation = null;
    }

    // Create the new annotation
    const vertices = this.samMainOutput;
    if (!vertices) {
      return;
    }
    const style = {
      fillOpacity: 0.2,
      fillColor: "blue",
      strokeColor: "white",
      strokeOpacity: 1,
      strokeWidth: 1,
    };
    const geoJsAnnotation = geojs.annotation.polygonAnnotation({
      style,
      vertices,
    });
    geoJsAnnotation.options("specialAnnotation", true);

    // Add it to the layer
    this.samUnsubmittedAnnotation = geoJsAnnotation;
    this.annotationLayer.addAnnotation(this.samUnsubmittedAnnotation);
  }

  get samLivePreviewOutput() {
    return this.samToolState?.livePreview ?? null;
  }

  @Watch("samLivePreviewOutput")
  onSamLivePreviewOutputChanged() {
    // Remove previous annotation
    if (this.samLivePreviewAnnotation) {
      this.annotationLayer.removeAnnotation(this.samLivePreviewAnnotation);
      this.samLivePreviewAnnotation = null;
    }

    // Create the new annotation
    const vertices = this.samLivePreviewOutput;
    if (!vertices) {
      return;
    }
    const style = {
      fillOpacity: 0.1,
      fillColor: "blue",
      strokeColor: "white",
      strokeOpacity: 0.5,
      strokeWidth: 1,
    };
    const geoJsAnnotation = geojs.annotation.polygonAnnotation({
      style,
      vertices,
    });
    geoJsAnnotation.options("specialAnnotation", true);

    // Add it to the layer
    this.samLivePreviewAnnotation = geoJsAnnotation;
    this.annotationLayer.addAnnotation(this.samLivePreviewAnnotation);
  }

  @Watch("capturedMouseState", { deep: true })
  onMousePathChanged(
    newState: IMouseState | null,
    oldState: IMouseState | null,
  ) {
    if (
      newState === null &&
      oldState !== null &&
      !oldState.isMouseMovePreviewState
    ) {
      this.consumeMouseState(oldState);
    } else {
      this.previewMouseState(newState);
    }
  }

  previewMouseState(mouseState: IMouseState | null) {
    if (this.selectionAnnotation) {
      this.annotationLayer.removeAnnotation(this.selectionAnnotation);
    }

    const baseStyle = {
      fillOpacity: 0,
      strokeColor: "white",
      strokeOpacity: 0.5,
      strokeWidth: 2,
      closed: true,
    };

    if (this.samToolState) {
      // Preview SAM prompt
      const previewPrompt = mouseState && mouseStateToSamPrompt(mouseState);
      const previewPromptNode = this.samToolState.nodes.input.previewPrompt;
      if (previewPrompt) {
        this.selectionAnnotation = samPromptToAnnotation(
          previewPrompt,
          baseStyle,
        );
        const currentPrompts = this.samPrompts;
        const previewPrompts = [...currentPrompts, previewPrompt];
        previewPromptNode.setValue(previewPrompts);
      } else {
        this.selectionAnnotation = null;
        previewPromptNode.setValue(NoOutput);
      }
    } else {
      // Preview shift drag select
      const vertices = mouseState?.path ?? [];
      if (vertices.length > 1) {
        this.selectionAnnotation = geojs.annotation.lineAnnotation({
          style: baseStyle,
          vertices,
        });
      } else {
        this.selectionAnnotation = null;
      }
    }

    if (this.selectionAnnotation) {
      this.selectionAnnotation.options("specialAnnotation", true);
      this.annotationLayer.addAnnotation(this.selectionAnnotation);
    }
  }

  consumeMouseState(mouseState: IMouseState) {
    if (this.selectionAnnotation) {
      this.annotationLayer.removeAnnotation(this.selectionAnnotation);
      this.selectionAnnotation = null;
    }
    const mousePath = mouseState.path;
    if (mousePath.length <= 0) {
      return;
    }
    if (this.samToolState) {
      // Create a new SAM prompt from the mouse state
      const newPrompt = mouseStateToSamPrompt(mouseState);
      if (newPrompt) {
        const promptNode = this.samToolState.nodes.input.mainPrompt;
        const currentPrompts = promptNode.output;
        const newPrompts =
          currentPrompts === NoOutput
            ? [newPrompt]
            : [...currentPrompts, newPrompt];
        promptNode.setValue(newPrompts);
      }
    } else {
      // Select the annotations using a point or a polygon annotation
      let annotation;
      if (
        mousePath.every(
          (point) => point.x === mousePath[0].x && point.y === mousePath[0].y,
        )
      ) {
        annotation = geojs.annotation.pointAnnotation();
        annotation!.options("position", mousePath[0]);
      } else {
        annotation = geojs.annotation.polygonAnnotation();
        annotation!.options("vertices", mousePath);
      }
      this.selectAnnotations(annotation);
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
          image: this.workerPreview.image,
        },
      ]);
    } else {
      this.workerPreviewFeature.data([]);
    }
    this.workerPreviewFeature.draw();
  }

  @Watch("samPrompts")
  onSamPromptsChanged(prompts: TSamPrompt[]) {
    // Update the annotations of the map
    for (const annotation of this.samPromptAnnotations) {
      this.annotationLayer.removeAnnotation(annotation);
    }
    const baseStyle = {
      fillOpacity: 0,
      strokeColor: "white",
      strokeOpacity: 1,
      strokeWidth: 2,
      closed: true,
    };
    const newAnnotations = [];
    for (const prompt of prompts) {
      const newAnnotation = samPromptToAnnotation(prompt, baseStyle);
      newAnnotation.options("specialAnnotation", true);
      this.annotationLayer.addAnnotation(newAnnotation);
      newAnnotations.push(newAnnotation);
    }
    this.samPromptAnnotations = newAnnotations;
  }

  get hoveredAnnotationId() {
    return this.annotationStore.hoveredAnnotationId;
  }

  get selectedAnnotations() {
    return this.annotationStore.selectedAnnotations;
  }

  getAnyLayerForChannel(channel: number) {
    return this.layers.find(
      (layer: IDisplayLayer) => channel === layer.channel,
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

  get baseStyle(): IGeoJSPointFeatureStyle &
    IGeoJSLineFeatureStyle &
    IGeoJSPolygonFeatureStyle {
    return {
      scaled: this.store.scaleAnnotationsWithZoom ? false : 1,
      radius: this.store.annotationsRadius,
      fillOpacity: this.store.annotationOpacity,
    };
  }

  getAnnotationStyle(
    annotationId: string,
    annotationColor: string | null,
    layerColor?: string,
  ) {
    // Use "hover" style for annotations selected by a tool
    const hovered =
      annotationId === this.hoveredAnnotationId ||
      this.toolHighlightedAnnotationIds.has(annotationId);
    const selected = this.isAnnotationSelected(annotationId);
    return getAnnotationStyleFromBaseStyle(
      this.baseStyle,
      annotationColor || layerColor,
      hovered,
      selected,
    );
  }

  // Get the index of the tile an annotation should be drawn in.
  unrollIndex(
    XY: number,
    Z: number,
    Time: number,
    unrollXY: boolean,
    unrollZ: boolean,
    unrollT: boolean,
  ) {
    const images = this.store.dataset?.images(
      unrollZ ? -1 : Z,
      unrollT ? -1 : Time,
      unrollXY ? -1 : XY,
      0,
    );
    if (!images) {
      return 0;
    }
    return unrollIndexFromImages(XY, Z, Time, images);
  }

  // Transform a list of coordinates, taking unrolling into account.
  unrolledCoordinates(
    coordinates: IGeoJSPosition[],
    location: IAnnotationLocation,
    image: IImage,
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
        this.store.unrollT,
      );

      const tileX = Math.floor(locationIdx % this.unrollW);
      const tileY = Math.floor(locationIdx / this.unrollW);

      return coordinates.map((point: IGeoJSPosition) => ({
        x: tileW * tileX + point.x,
        y: tileH * tileY + point.y,
        z: point.z,
      }));
    }
    return coordinates;
  }

  drawAnnotationsAndTooltips() {
    this.drawAnnotations();
    this.drawTooltips();
  }

  drawAnnotations = throttle(this.drawAnnotationsNoThrottle, THROTTLE).bind(
    this,
  );
  drawAnnotationsNoThrottle() {
    if (!this.annotationLayer) {
      return;
    }

    if (!this.shouldDrawAnnotations) {
      this.clearOldAnnotations(true);
      return;
    }

    // First remove undesired annotations (layer was disabled and showAnnotationsFromHiddenLayers is false, uneligible coordinates...)
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
    this.textLayer.features().forEach((feature: IGeoJSFeature) => {
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
        textStrokeWidth: 2,
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
          ...baseStyle,
        });
      yOffset += 12;
      for (const propertyPath of this.displayedPropertyPaths) {
        const fullName = this.propertyStore.getSubIdsNameFromPath(propertyPath);
        if (fullName) {
          const propertyValues = this.propertyValues;
          const propertyData: Map<string, string> = new Map();
          const filteredIds: string[] = [];
          for (const annotation of this.displayedAnnotations) {
            const stringValue = getStringFromPropertiesAndPath(
              propertyValues[annotation.id],
              propertyPath,
            );
            if (stringValue) {
              propertyData.set(annotation.id, stringValue);
              filteredIds.push(annotation.id);
            }
          }
          this.textLayer
            .createFeature("text")
            .data(filteredIds)
            .position(
              (annotationId: string) => unrolledCoordinates[annotationId],
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
              ...baseStyle,
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
      this.lowestLayer + this.layerCount,
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

      // Get all annotations in the layer's channel
      // Check if we should include annotations for this layer
      if (layer.visible || this.showAnnotationsFromHiddenLayers) {
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
        const {
          girderId,
          layerId,
          isConnection,
          childId,
          parentId,
          specialAnnotation,
          color,
        } = geoJsAnnotation.options();

        if (
          geoJsAnnotation === this.annotationLayer.currentAnnotation ||
          specialAnnotation
        ) {
          // Don't do anything with currentAnnotation as it is used internally by geoJS
          // Don't remove special annotations as they are removed by other ways
          return;
        }

        if (clearAll) {
          this.annotationLayer.removeAnnotation(geoJsAnnotation, false);
          this.annotationLayer.modified();
          return;
        }

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
          this.layerDisplaysAnnotation(layer.id, annotation.id) &&
          annotation.color === color
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
      if (layer) {
        for (const [annotationId, annotation] of annotationMap) {
          const excluded = drawnGeoJSAnnotations
            .get(annotationId)
            ?.some(
              (geoJSAnnotation) =>
                geoJSAnnotation.options("layerId") === layer.id,
            );
          if (!excluded) {
            const geoJSAnnotation = this.createGeoJSAnnotation(
              annotation,
              layerId,
            );
            if (geoJSAnnotation) {
              this.annotationLayer.addAnnotation(
                geoJSAnnotation,
                undefined,
                false,
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
        const { layerId, isHovered, isSelected, style, customColor } =
          geoJSAnnotation.options();
        // If hover or select changed, update style
        if (isHovered != isHoveredGT || isSelected != isSelectedGT) {
          const layer = this.store.getLayerFromId(layerId);
          const newStyle = this.getAnnotationStyle(
            annotationId,
            customColor,
            layer?.color,
          );
          geoJSAnnotation.options("style", { ...style, ...newStyle });
          geoJSAnnotation.options("isHovered", isHoveredGT);
          geoJSAnnotation.options("isSelected", isSelectedGT);
        }
      }
    }
  }

  drawNewConnections(drawnGeoJSAnnotations: Map<string, IGeoJSAnnotation[]>) {
    const displayedAnnotationIds = this.displayedAnnotationIds;
    const getAnnotationFromId = this.getAnnotationFromId;
    this.annotationConnections.forEach((connection: IAnnotationConnection) => {
      // If connection is drawn, or one of the parent is not displayed, don't display
      if (
        drawnGeoJSAnnotations.has(connection.id) ||
        !displayedAnnotationIds.has(connection.parentId) ||
        !displayedAnnotationIds.has(connection.childId)
      ) {
        return;
      }
      // Get the two annotations for this connection
      const childAnnotation = getAnnotationFromId(connection.childId);
      const parentAnnotation = getAnnotationFromId(connection.parentId);
      if (!childAnnotation || !parentAnnotation) {
        return;
      }
      // Draw the connection
      this.drawGeoJSAnnotationFromConnection(
        connection,
        childAnnotation,
        parentAnnotation,
      );
    });
  }

  createGeoJSAnnotation(annotation: IAnnotation, layerId?: string) {
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
      color: annotation.color,
      isSelected: false,
      layerId,
    };

    const coordinates = this.unrolledCoordinates(
      annotation.coordinates,
      annotation.location,
      anyImage,
    );

    const newGeoJSAnnotation = geojsAnnotationFactory(
      annotation.shape,
      coordinates,
      girderOptions,
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

    const customColor = annotation.color;
    if (customColor) {
      newGeoJSAnnotation.options("customColor", customColor);
    }

    const style = newGeoJSAnnotation.options("style");
    const layer = this.store.getLayerFromId(layerId);
    const newStyle = this.getAnnotationStyle(
      annotation.id,
      customColor,
      layer?.color,
    );
    newGeoJSAnnotation.options("style", Object.assign({}, style, newStyle));

    return newGeoJSAnnotation;
  }

  // Draw lines as a way to show the connections
  drawGeoJSAnnotationFromConnection(
    connection: IAnnotationConnection,
    parent: IAnnotation,
    child: IAnnotation,
  ) {
    const pA = { ...this.unrolledCentroidCoordinates[child.id] };
    delete pA.z;
    const pB = { ...this.unrolledCentroidCoordinates[parent.id] };
    delete pB.z;
    const line = geojs.annotation.lineAnnotation();
    line.options("vertices", [pA, pB]);
    line.options("isConnection", true);
    line.options("childId", connection.childId);
    line.options("parentId", connection.parentId);
    line.options("girderId", connection.id);
    this.annotationLayer.addAnnotation(line, undefined, false);
  }

  private async createAnnotationFromTool(
    coordinates: IGeoJSPosition[],
    tool: IToolConfiguration,
  ) {
    if (!coordinates || !coordinates.length || !this.dataset) {
      return null;
    }
    const annotation = await this.annotationStore.addAnnotationFromTool({
      coordinates,
      toolConfiguration: tool,
      datasetId: this.dataset.id,
    });
    this.drawAnnotationsAndTooltips();
    return annotation;
  }

  private restyleAnnotations() {
    for (const geoJSAnnotation of this.annotationLayer.annotations()) {
      const { girderId, layerId, style, customColor } =
        geoJSAnnotation.options();
      if (girderId) {
        const layer = this.store.getLayerFromId(layerId);
        const newStyle = this.getAnnotationStyle(
          girderId,
          customColor,
          layer?.color,
        );
        geoJSAnnotation.options("style", Object.assign({}, style, newStyle));
      }
    }
    this.annotationLayer.draw();
  }

  private shouldSelectAnnotation(
    selectionAnnotationType: AnnotationShape,
    selectionAnnotationCoordinates: IGeoJSPosition[],
    annotation: IAnnotation,
    annotationStyle: IGeoJSPointFeatureStyle &
      IGeoJSLineFeatureStyle &
      IGeoJSPolygonFeatureStyle,
    unitsPerPixel: number,
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
        const annotationRadius =
          ((radius as number) + (strokeWidth as number)) * unitsPerPixel;
        const annotationPosition = annotationCoordinates[0];
        return (
          pointDistance(selectionPosition, annotationPosition) <
          annotationRadius
        );
      } else if (annotation.shape === AnnotationShape.Line) {
        // Check if click on points of the line, or on the line directly
        const width = (strokeWidth as number) * unitsPerPixel;
        return annotationCoordinates.reduce(
          (isIn: boolean, point: IGeoJSPosition, index: number) => {
            let isPointInLine = false;
            if (index === annotationCoordinates.length - 1) {
              // Specific case for the last point that does not have a next point
              isPointInLine = pointDistance(point, selectionPosition) < width;
            } else {
              isPointInLine =
                geojs.util.distance2dToLineSquared(
                  selectionPosition,
                  point,
                  annotationCoordinates[index + 1],
                ) < width;
            }
            return isIn || isPointInLine;
          },
          false,
        );
      } else {
        return geojs.util.pointInPolygon(
          selectionPosition,
          annotationCoordinates,
        );
      }
    } else {
      // If the selection annotation type is "Polygon"
      // Check if the tested annotation (independently from its type)
      // is in the defined polygon
      return annotation.coordinates.some((point: IGeoJSPosition) => {
        return geojs.util.pointInPolygon(point, selectionAnnotationCoordinates);
      });
    }
  }

  private getSelectedAnnotationsFromAnnotation(
    selectAnnotation: IGeoJSAnnotation,
  ) {
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
          geoJSannotation: IGeoJSAnnotation,
        ) => {
          const { girderId, isConnection } = geoJSannotation.options();
          if (
            !girderId ||
            isConnection ||
            selectedAnnotations.some(
              (selectedAnnotation) => selectedAnnotation.id === girderId,
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
              unitsPerPixel,
            )
          ) {
            return selectedAnnotations;
          }
          return [...selectedAnnotations, annotation];
        },
        [],
      );
    return selectedAnnotations;
  }

  private selectAnnotations(selectAnnotation: IGeoJSAnnotation) {
    if (!selectAnnotation) {
      return;
    }
    const selectedAnnotations =
      this.getSelectedAnnotationsFromAnnotation(selectAnnotation);

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

  private async handleAnnotationConnections(
    selectAnnotation: IGeoJSAnnotation,
  ) {
    const datasetId = this.dataset?.id;
    if (!selectAnnotation || !datasetId || !this.selectedToolConfiguration) {
      return;
    }
    const selectedAnnotations =
      this.getSelectedAnnotationsFromAnnotation(selectAnnotation);

    const parentTemplate = this.selectedToolConfiguration.values
      ?.parentAnnotation as IRestrictTagsAndLayer;
    const childTemplate = this.selectedToolConfiguration.values
      ?.childAnnotation as IRestrictTagsAndLayer;
    if (!parentTemplate || !childTemplate) {
      return;
    }
    // Get all the parents and children
    const parents = filterAnnotations(selectedAnnotations, parentTemplate);
    const children = filterAnnotations(selectedAnnotations, childTemplate);
    const parentIds = parents.map((a) => a.id);
    const childIds = children.map((a) => a.id);

    // Can be add_click, add_lasso, delete_lasso, delete_click
    const action = this.selectedToolConfiguration.values.action.value;
    const addAction = action.startsWith("add");
    const clickAction = action.endsWith("click");
    const clickedAnnotation = selectedAnnotations[0];

    if (addAction) {
      if (clickAction) {
        // Select an annotation or connect to selected annotation
        if (
          clickedAnnotation &&
          this.selectedToolState?.type === ConnectionToolStateSymbol &&
          this.selectedToolState.selectedAnnotationId
        ) {
          // Connect to selected
          this.annotationStore.createConnection({
            parentId: this.selectedToolState.selectedAnnotationId,
            childId: clickedAnnotation.id,
            datasetId,
            label: this.selectedToolConfiguration.name,
            tags: [...parentTemplate.tags, ...childTemplate.tags],
          });
        }
      } else {
        // Add all connections between a parent and a child
        await this.annotationStore.createAllConnections({
          parentIds,
          childIds,
          label: this.selectedToolConfiguration.name,
          tags: [...parentTemplate.tags, ...childTemplate.tags],
        });
      }
    } else {
      if (clickAction) {
        // Select an annotation or connect to selected annotation
        if (
          clickedAnnotation &&
          this.selectedToolState?.type === ConnectionToolStateSymbol &&
          this.selectedToolState.selectedAnnotationId
        ) {
          // Disconnect from selected
          const firstId = this.selectedToolState.selectedAnnotationId;
          const secondId = clickedAnnotation.id;
          this.annotationStore.deleteAllConnections({
            childIds: [firstId, secondId],
            parentIds: [firstId, secondId],
          });
        }
      } else {
        // Delete any connection between a parent and a child
        await this.annotationStore.deleteAllConnections({
          parentIds,
          childIds,
        });
      }
    }

    // Reset or set the selected annotation id in the tool state
    if (
      clickAction &&
      this.selectedToolState?.type === ConnectionToolStateSymbol
    ) {
      const selectedId = this.selectedToolState.selectedAnnotationId;
      Vue.set(
        this.selectedToolState,
        "selectedAnnotationId",
        selectedId || !clickedAnnotation ? null : clickedAnnotation.id,
      );
    }

    // Remove the selection annotation from layer (do not show the annotation used to select)
    this.annotationLayer.removeAnnotation(selectAnnotation);
  }

  private async addAnnotationFromGeoJsAnnotation(annotation: IGeoJSAnnotation) {
    if (!annotation || !this.selectedToolConfiguration) {
      return;
    }

    const coordinates = annotation.coordinates();
    this.annotationLayer.removeAnnotation(annotation);

    // Create the new annotation
    await this.createAnnotationFromTool(
      coordinates,
      this.selectedToolConfiguration,
    );
  }

  async addAnnotationFromSnapping(annotation: IGeoJSAnnotation) {
    if (!annotation || this.maps.length !== 1) {
      return;
    }
    const mapentry = this.maps[0];
    const coordinates = annotation.coordinates();
    this.annotationLayer.removeAnnotation(annotation);
    if (!this.selectedToolConfiguration) {
      return;
    }
    const location =
      this.selectedToolConfiguration.values.annotation.coordinateAssignments;
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
    // Capture a screenshot of the layer and convert to png binary
    const canvas = await mapentry.map.screenshot(layerImage, "canvas");
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r));
    if (!blob) {
      return;
    }
    const array = new Uint8Array(await blob.arrayBuffer());
    // Compute snapped coordinates
    const snappedCoordinates = await snapCoordinates(
      coordinates,
      array,
      this.selectedToolConfiguration,
      mapentry.map,
    );
    if (!snappedCoordinates || !snappedCoordinates.length) {
      logError("Failed to compute new coordinates for the snapping tool");
      return;
    }
    // Create the new annotation
    await this.createAnnotationFromTool(
      snappedCoordinates,
      this.selectedToolConfiguration,
    );
  }

  handleNewROIFilter(geojsAnnotation: IGeoJSAnnotation) {
    if (!this.roiFilter) {
      return;
    }
    this.filterStore.validateNewROIFilter(geojsAnnotation.coordinates());
    this.annotationLayer.removeAnnotation(geojsAnnotation);
  }

  get selectedToolRadius(): number | undefined {
    return this.selectedToolConfiguration?.values?.radius;
  }

  cursorAnnotation: IGeoJSAnnotation | null = null;
  lastCursorPosition: { x: number; y: number } = { x: 0, y: 0 };

  @Watch("selectedToolRadius")
  updateCursorAnnotation(evt?: any) {
    if (
      !this.selectedToolConfiguration ||
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
          y: basePositionDisplay.y - this.selectedToolRadius,
        },
        {
          x: basePositionDisplay.x + this.selectedToolRadius,
          y: basePositionDisplay.y - this.selectedToolRadius,
        },
        {
          x: basePositionDisplay.x + this.selectedToolRadius,
          y: basePositionDisplay.y + this.selectedToolRadius,
        },
        {
          x: basePositionDisplay.x - this.selectedToolRadius,
          y: basePositionDisplay.y + this.selectedToolRadius,
        },
      ].map((point) => map.displayToGcs(point)),
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
      this.updateCursorAnnotation,
    );
    this.annotationLayer.geoOn(geojs.event.zoom, this.updateCursorAnnotation);
    this.cursorAnnotation.style({
      fill: true,
      fillColor: "white",
      fillOpacity: 0.2,
      strokeWidth: 3,
      strokeColor: "black",
    });
    this.updateCursorAnnotation();
  }

  refreshAnnotationMode() {
    this.clearAnnotationMode();
    this.setNewAnnotationMode();
  }

  clearAnnotationMode() {
    // Remove cursor annotation if there is one
    if (this.cursorAnnotation) {
      this.annotationLayer.removeAnnotation(this.cursorAnnotation);
      this.annotationLayer.geoOff(
        geojs.event.mousemove,
        this.updateCursorAnnotation,
      );
      this.annotationLayer.geoOff(
        geojs.event.zoom,
        this.updateCursorAnnotation,
      );
      this.cursorAnnotation = null;
    }
  }

  setNewAnnotationMode() {
    if (this.unrolling) {
      this.annotationLayer.mode(null);
      return;
    }

    if (this.roiFilter) {
      if (this.selectedToolConfiguration) {
        this.store.setSelectedToolId(null);
      }
      this.annotationLayer.mode("polygon");
      return;
    }

    switch (this.selectedToolConfiguration?.type) {
      case "create":
        const annotation = this.selectedToolConfiguration.values.annotation;
        this.annotationLayer.mode(annotation?.shape);
        break;
      case "tagging":
        if (
          ["tag_click", "untag_click"].includes(
            this.selectedToolConfiguration.values.action.value,
          )
        ) {
          this.annotationLayer.mode("point");
        } else {
          this.annotationLayer.mode("polygon");
        }
        break;
      case "snap":
        if (
          this.selectedToolConfiguration.values.snapTo.value === "circleToDot"
        ) {
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
        if (
          this.selectedToolConfiguration.values.action.value.endsWith("click")
        ) {
          this.annotationLayer.mode("point");
        } else {
          this.annotationLayer.mode("polygon");
        }
        break;
      case "select":
        const selectionType =
          this.selectedToolConfiguration.values.selectionType.value ===
          "pointer"
            ? "point"
            : "polygon";
        this.annotationLayer.mode(selectionType);
        break;
      case "edit":
        if (
          this.selectedToolConfiguration.values.editionType.value === "edit"
        ) {
          this.annotationLayer.mode("point"); // For selection
        } else {
          this.annotationLayer.mode(null);
        }
        break;
      case "samAnnotation":
      case null:
      case undefined:
        this.annotationLayer.mode(null);
        break;
      default:
        logWarning(
          `${this.selectedToolConfiguration?.type} tools are not supported yet`,
        );
        this.annotationLayer.mode(null);
    }

    if (this.selectedToolConfiguration?.type === "tagging") {
      this.annotationLayer.geoOn(
        geojs.event.mouseclick,
        this.handleTaggingClick,
      );
    } else {
      this.annotationLayer.geoOff(
        geojs.event.mouseclick,
        this.handleTaggingClick,
      );
    }
  }

  handleModeChange(evt: any) {
    if (evt.mode === null) {
      this.refreshAnnotationMode();
    }
  }

  setHoveredAnnotationFromCoordinates(gcsCoordinates: IGeoJSPosition) {
    const geoAnnotations: IGeoJSAnnotation[] =
      this.annotationLayer.annotations();
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
        unitsPerPixel,
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
    if (!this.selectedToolConfiguration && !this.roiFilter) {
      return;
    }

    if (
      evt.event === "geo_annotation_state" &&
      evt.annotation?.layer() === this.annotationLayer
    ) {
      if (this.selectedToolConfiguration) {
        switch (this.selectedToolConfiguration.type) {
          case "create":
            this.addAnnotationFromGeoJsAnnotation(evt.annotation);
            break;
          case "tagging":
            this.handleAnnotationTagging(evt.annotation);
            break;
          case "snap":
            this.addAnnotationFromSnapping(evt.annotation);
            break;
          case "select":
            this.selectAnnotations(evt.annotation);
            break;
          case "edit":
            console.log("handleAnnotationChange edit", evt);
            this.handleEditClick(evt.annotation);
            break;
          case "connection":
            this.handleAnnotationConnections(evt.annotation);
            break;
        }
      } else {
        this.handleNewROIFilter(evt.annotation);
      }
    }
  }

  // AR: I added some code here to prevent duplicate redraws. I found that when e.g. xy changes, then the watcher for displayedAnnotations also changed.
  // This caused a double redraw. But the problem is that if you remove the watcher for displayedAnnotations, then the annotations are not redrawn when the user for instance deletes an annotation.
  // The solution implemented here is to have a flag that is set when any of the primary watchers are triggered, and then unset when the drawAnnotationsAndTooltips is called.
  // However, I don't think this is a robust solution, because it makes it very hard to track down exactly what watchers could be double-triggering the redraw.
  // It also makes the code harder to understand.
  // TODO: I think a better solution would be to have a Vuex store variable that sets a single flag for a redraw. Then, if multiple watchers trigger a redraw, the flag is already set and the redraw would not be triggered.
  // That would also the logic for redrawing a lot more explicit and easier to understand.
  // I decided not to implement this just yet because I think it would require a fair number of changes and debugging, so it didn't seem worth it right now. But if we run into more such issues, we should consider it.
  // Add this property to track if we're handling a redraw from a primary change
  private handlingPrimaryChange = false;

  @Watch("annotationConnections")
  @Watch("xy")
  @Watch("z")
  @Watch("time")
  @Watch("hoveredAnnotationId")
  @Watch("selectedAnnotations")
  @Watch("shouldDrawAnnotations")
  @Watch("shouldDrawConnections")
  onPrimaryChange() {
    // Set flag before triggering redraw
    this.handlingPrimaryChange = true;
    this.drawAnnotationsAndTooltips();
    // Clear flag after a tick to allow Vue to process all watchers
    Vue.nextTick(() => {
      this.handlingPrimaryChange = false;
    });
  }

  @Watch("displayedAnnotations")
  onDisplayedAnnotationsChange() {
    // Only trigger redraw if we're not already handling a primary change
    if (!this.handlingPrimaryChange) {
      this.drawAnnotationsAndTooltips();
    }
  }

  @Watch("baseStyle")
  @Watch("layers")
  @Watch("toolHighlightedAnnotationIds")
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

  @Watch("selectedToolConfiguration")
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
        annotation.options("isRoiFilter"),
      )
      .forEach((annotation: IGeoJSAnnotation) => {
        this.annotationLayer.removeAnnotation(annotation);
      });
    this.enabledRoiFilters.forEach((filter: IROIAnnotationFilter) => {
      const newGeoJSAnnotation = geojsAnnotationFactory("polygon", filter.roi, {
        id: filter.id,
        isRoiFilter: true,
      });

      if (!newGeoJSAnnotation) {
        return;
      }

      newGeoJSAnnotation.style({
        fill: false,
        strokeWidth: 3,
        strokeColor: "black",
      });
      this.annotationLayer.addAnnotation(newGeoJSAnnotation);
    });
  }

  @Watch("annotationLayer")
  bind() {
    this.annotationLayer.geoOn(
      geojs.event.annotation.mode,
      this.handleModeChange,
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.mode,
      this.handleAnnotationChange,
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.add,
      this.handleAnnotationChange,
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.update,
      this.handleAnnotationChange,
    );
    this.annotationLayer.geoOn(
      geojs.event.annotation.state,
      this.handleAnnotationChange,
    );
    this.drawAnnotationsAndTooltips();
    this.annotationLayer.geoOn(
      geojs.event.mouseclick,
      (evt: IGeoJSMouseState) => {
        if (evt.buttonsDown.right) {
          this.handleAnnotationRightClick(evt);
        }
      },
    );
  }

  @Watch("annotationLayer")
  @Watch("valueOnHover")
  updateValueOnHover() {
    this.store.setHoverValue(null);
    if (this.valueOnHover) {
      this.annotationLayer.geoOn(
        geojs.event.mousemove,
        this.handleValueOnMouseMove,
      );
    } else {
      this.annotationLayer.geoOff(
        geojs.event.mousemove,
        this.handleValueOnMouseMove,
      );
    }
  }

  handleValueOnMouseMove(e: any) {
    this.store.setHoverValue(null);
    this.handleValueOnMouseMoveDebounce(e);
  }

  handleValueOnMouseMoveDebounce = debounce(
    this.handleValueOnMouseMoveNoDebounce,
    25,
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
            .then((pixel) => {
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
      if (this.selectedToolConfiguration === null && evt?.geo) {
        this.setHoveredAnnotationFromCoordinates(evt.geo);
      }
    });
  }

  private async handleAnnotationTagging(annotation: IGeoJSAnnotation) {
    if (!annotation) {
      return;
    }
    const selectedAnnotations =
      this.getSelectedAnnotationsFromAnnotation(annotation);
    if (selectedAnnotations.length > 0) {
      const action = this.selectedToolConfiguration?.values?.action?.value;
      const tags = this.selectedToolConfiguration?.values?.tags || [];
      const removeExisting =
        this.selectedToolConfiguration?.values?.removeExisting || false;

      await this.updateAnnotationTags(
        selectedAnnotations.map((a) => a.id),
        action,
        tags,
        removeExisting,
      );

      // Highlight the last tagged annotation in the list
      if (selectedAnnotations.length === 1) {
        this.annotationStore.setHoveredAnnotationId(selectedAnnotations[0].id);
      }
    }
    this.annotationLayer.removeAnnotation(annotation);
  }

  private handleEditClick(annotation: IGeoJSAnnotation) {
    if (!annotation) {
      return;
    }

    console.log("handleEditClick", annotation);

    // Find which annotation was clicked using the same logic as other click handlers
    const selectedAnnotations =
      this.getSelectedAnnotationsFromAnnotation(annotation);

    if (selectedAnnotations.length === 1) {
      console.log("selectedAnnotations", selectedAnnotations);

      // Get the GeoJS annotation object for the selected annotation
      const geoAnnotations = this.annotationLayer.annotations();
      const geoAnnotation = geoAnnotations.find(
        (a) => a.options("girderId") === selectedAnnotations[0].id,
      );

      console.log("geoAnnotation", geoAnnotation);
      console.log("geoAnnotation.state()", geoAnnotation?.state());

      if (geoAnnotation) {
        if (geoAnnotation.state() === "done") {
          console.log(
            "Setting edit mode for annotation:",
            selectedAnnotations[0].id,
          );
          this.annotationLayer.mode("edit", geoAnnotation);
        }
      }
    }
  }

  private handleTaggingClick = (evt: any) => {
    if (
      !this.selectedToolConfiguration ||
      this.selectedToolConfiguration.type !== "tagging" ||
      !evt?.geo
    ) {
      return;
    }

    const selectedAnnotations = this.getSelectedAnnotationsFromAnnotation({
      type: () => AnnotationShape.Point,
      coordinates: () => [evt.geo],
    } as IGeoJSAnnotation);

    if (selectedAnnotations.length === 1) {
      const selectedAnnotation = selectedAnnotations[0];
      const action = this.selectedToolConfiguration.values.action.value;
      const tags = this.selectedToolConfiguration.values.tags || [];
      const removeExisting =
        this.selectedToolConfiguration?.values?.removeExisting || false;

      this.updateAnnotationTags(
        [selectedAnnotation.id],
        action,
        tags,
        removeExisting,
      );

      // Highlight the tagged annotation in the list
      this.annotationStore.setHoveredAnnotationId(selectedAnnotation.id);
    }
  };

  private async updateAnnotationTags(
    annotationIds: string[],
    action: string,
    tags: string[],
    removeExisting: boolean,
  ) {
    await this.annotationStore.updateAnnotationsPerId({
      annotationIds,
      editFunction: (annotation: IAnnotation): void => {
        if (action.startsWith("untag")) {
          // Remove specified tags if they exist
          annotation.tags = annotation.tags.filter(
            (tag) => !tags.includes(tag),
          );
        } else {
          // Add tags (either replacing or merging)
          annotation.tags = removeExisting
            ? [...tags]
            : [...new Set([...annotation.tags, ...tags])];
        }
      },
    });
  }

  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  rightClickedAnnotation: IAnnotation | null = null;

  handleAnnotationRightClick(evt: IGeoJSMouseState) {
    if (!evt) {
      return;
    }

    // Find which annotation was clicked
    // TODO: It is possible that this could be optimized by directly asking GeoJS for the annotationId
    const geoAnnotations: IGeoJSAnnotation[] =
      this.annotationLayer.annotations();
    for (const geoAnnotation of geoAnnotations) {
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
        [evt.geo],
        annotation,
        geoAnnotation.style(),
        unitsPerPixel,
      );
      if (shouldSelect) {
        // Show context menu
        this.rightClickedAnnotation = annotation;
        this.contextMenuX = evt.evt.clientX;
        this.contextMenuY = evt.evt.clientY;
        this.showContextMenu = true;
        break;
      }
    }
  }

  handleContextMenuCancel() {
    this.showContextMenu = false;
    this.rightClickedAnnotation = null;
  }

  handleContextMenuSave({
    annotationId,
    color,
  }: {
    annotationId?: string;
    color: string;
  }) {
    if (annotationId) {
      this.annotationStore.colorAnnotationIds({
        annotationIds: [annotationId],
        color,
      });
    }
    this.showContextMenu = false;
    this.rightClickedAnnotation = null;
  }

  // Add this helper method to handle annotation edits
  private handleAnnotationEdit(evt: any) {
    if (!evt.annotation) {
      return;
    }

    // Only process completed edits
    // GeoJS annotation states are: 0=create, 1=done, 2=edit
    if (evt.annotation.state() !== 1) {
      // 1 is the "done" state
      return;
    }

    const id = evt.annotation.options("girderId");
    if (!id) {
      return;
    }

    const annotation = this.getAnnotationFromId(id);
    if (!annotation) {
      return;
    }

    // Update the annotation coordinates in our data model
    const editFunction = (annotation: IAnnotation): void => {
      annotation.coordinates = evt.annotation.coordinates();
    };

    this.annotationStore.updateAnnotationsPerId({
      annotationIds: [id],
      editFunction,
    });
  }
}
</script>

<style lang="scss" scoped></style>
