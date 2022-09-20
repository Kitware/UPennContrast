<template>
  <div></div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import toolsStore from "@/store/tool";
import propertiesStore from "@/store/properties";
import filterStore from "@/store/filters";

import geojs from "geojs";

import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationLocation,
  IDisplayLayer,
  IGeoJSPoint,
  IImage,
  IToolConfiguration,
  IROIAnnotationFilter,
  AnnotationShape,
  AnnotationSelectionTypes
} from "../store/model";

import { logWarning } from "@/utils/log";

import {
  pointDistance,
  getAnnotationStyleFromLayer,
  unrollIndexFromImages,
  geojsAnnotationFactory,
  annotationDistance,
  simpleCentroid
} from "@/utils/annotation";

// Draws annotations on the given layer, and provides functionnality for the user selected tool.
@Component({ components: {} })
export default class AnnotationViewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly toolsStore = toolsStore;
  readonly propertiesStore = propertiesStore;
  readonly filterStore = filterStore;

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

  @Prop()
  readonly tileWidth: any;

  @Prop()
  readonly tileHeight: any;

  get displayWorkerPreview() {
    return this.propertiesStore.displayWorkerPreview;
  }

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
      return [...channels];
    }, []);
  }

  get annotations() {
    if (this.store.drawActive) {
      return this.annotationStore.annotations.filter(
        (annotation: IAnnotation) =>
          this.annotationStore.activeAnnotationIds.includes(annotation.id)
      );
    }
    return this.store.filteredDraw
      ? this.filterStore.filteredAnnotations
      : this.annotationStore.annotations;
  }

  get annotationIds() {
    return this.annotations.map((annotation: IAnnotation) => annotation.id);
  }

  // All annotations available for the currently enabled layers
  get layerAnnotations() {
    return this.annotations.filter(annotation =>
      this.visibleChannels.includes(annotation.channel)
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

  get workerImage() {
    return this.selectedTool?.values?.image?.image;
  }

  get workerPreview() {
    return this.workerImage
      ? this.propertiesStore.getWorkerPreview(this.workerImage)
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
    if (!this.selectedToolId) {
      return null;
    }
    const tool = this.toolsStore.tools.find(
      (tool: IToolConfiguration) => tool.id === this.selectedToolId
    );
    return tool || null;
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

  get shouldDrawTooltips(): boolean {
    return this.store.drawTooltips;
  }

  get tooltipOnAll(): boolean {
    return this.store.tooltipOnAll;
  }

  get tooltipOnSelected(): boolean {
    return this.store.tooltipOnSelected;
  }

  get tooltipOnHovered(): boolean {
    return this.store.tooltipOnHovered;
  }

  getAnnotationStyle(annotation: IAnnotation) {
    const layer = this.getAnyLayerForChannel(annotation.channel);
    return getAnnotationStyleFromLayer(
      layer,
      annotation.id === this.hoveredAnnotationId,
      this.isAnnotationSelected(annotation.id)
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

    // First remove undesired annotations (layer was disabled, uneligible coordinates...)
    this.clearOldAnnotations();

    // We want to ignore these already displayed annotations
    const displayedIds = this.annotationLayer
      .annotations()
      .map((a: any) => a.options("girderId"))
      .filter(
        (id: string) =>
          id !== this.hoveredAnnotationId || !this.isAnnotationSelected(id)
      );

    // Then draw the new annotations
    this.drawNewAnnotations(displayedIds);
    if (this.shouldDrawConnections) {
      this.drawNewConnections(displayedIds);
    }
    this.annotationLayer.draw();
    this.drawTooltips();
  }

  drawTooltips() {
    const oldFeatures = this.textLayer.features();

    if (this.shouldDrawTooltips) {
      // Avoid checking the store for each annotation
      const all = this.tooltipOnAll;
      const selected = this.tooltipOnSelected;
      const hovered = this.tooltipOnHovered;

      const displayedAnnotations = this.annotationLayer
        .annotations()
        .map((a: any) => a.options("storedAnnotation"))
        .filter((a: any) => {
          return (
            a &&
            (all ||
              (hovered && this.hoveredAnnotationId === a.id) ||
              (selected && this.isAnnotationSelected(a.id)))
          );
        });

      // One text feature per line as in https://opengeoscience.github.io/geojs/tutorials/text/
      // Centroid is computed once per new line (optimization needed?)
      // TODO: More performance with renderThreshold https://opengeoscience.github.io/geojs/apidocs/geo.textFeature.html#.styleSpec
      const baseStyle = {
        fontSize: "12px",
        fontFamily: "sans-serif",
        textAlign: "center",
        textBaseline: "middle",
        color: "black",
        textStrokeColor: "#FFF8",
        textStrokeWidth: 2
      };
      this.textLayer
        .createFeature("text")
        .data(displayedAnnotations)
        .position((annotation: IAnnotation) => {
          return simpleCentroid(annotation.coordinates);
        })
        .style({
          text: (annotation: IAnnotation) => {
            return (
              "XY, Z, T = " +
              annotation.location.XY +
              ", " +
              annotation.location.Z +
              ", " +
              annotation.location.Time
            );
          },
          offset: { x: 0, y: -6 },
          ...baseStyle
        });
      this.textLayer
        .createFeature("text")
        .data(displayedAnnotations)
        .position((annotation: IAnnotation) => {
          return simpleCentroid(annotation.coordinates);
        })
        .style({
          text: (annotation: IAnnotation) => {
            return "[ " + annotation.tags.join(", ") + " ]";
          },
          offset: { x: 0, y: 6 },
          ...baseStyle
        });
    }

    // Delete the old feature after displaying the new one to avoid flickering
    oldFeatures.forEach((feature: any) => {
      this.textLayer.deleteFeature(feature);
    });
    this.textLayer.draw();
  }

  shouldDisplayAnnotationWithChannel(channelId: number): boolean {
    return this.visibleChannels.includes(channelId);
  }

  shouldDisplayAnnotationWithLocation(location: IAnnotationLocation): boolean {
    return (
      !location ||
      !(
        (location.XY !== this.store.xy && !this.store.unrollXY) ||
        (location.Z !== this.store.z && !this.store.unrollZ) ||
        (location.Time !== this.store.time && !this.store.unrollT)
      )
    );
  }

  shouldDisplayAnnotation(annotation: IAnnotation): boolean {
    if (!annotation.location) {
      return false;
    }
    if (annotation.id === this.hoveredAnnotationId) {
      return true;
    }
    return this.shouldDisplayAnnotationWithLocation(annotation.location);
  }

  // Remove from the layer annotations that should no longer be renderered (index change, layer change...)
  clearOldAnnotations(clearAll = false) {
    this.annotationLayer.annotations().forEach((annotation: any) => {
      if (clearAll) {
        this.annotationLayer.removeAnnotation(annotation);
        return;
      }

      const {
        girderId,
        isHovered,
        isConnection,
        location,
        channel,
        isSelected
      } = annotation.options();

      if (!girderId) {
        return;
      }

      // Remove (not)hovered annotation
      if (girderId === this.hoveredAnnotationId && !isHovered) {
        this.annotationLayer.removeAnnotation(annotation, false);
      } else if (girderId !== this.hoveredAnnotationId && isHovered) {
        this.annotationLayer.removeAnnotation(annotation, false);
      }

      // Remove (un)selected annotation
      const isSelectedOnStore = this.isAnnotationSelected(girderId);
      if (
        (!isSelected && isSelectedOnStore) ||
        (isSelected && !isSelectedOnStore)
      ) {
        this.annotationLayer.removeAnnotation(annotation, false);
      }

      // Check for connections
      if (isConnection) {
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
          this.annotationLayer.removeAnnotation(annotation, false);
        }
        return;
      }

      if (girderId === this.hoveredAnnotationId) {
        return;
      }

      if (
        this.shouldDisplayAnnotationWithLocation(location) &&
        this.shouldDisplayAnnotationWithChannel(channel) &&
        (!this.store.filteredDraw || this.annotationIds.includes(girderId))
      ) {
        return;
      }

      this.annotationLayer.removeAnnotation(annotation, false);
    });
    this.annotationLayer.modified();
    this.annotationLayer.draw();
  }

  // Add to the layer annotations that should be rendered and have not already been added.
  drawNewAnnotations(existingIds: string[]) {
    this.layerAnnotations
      // Check for annotation that have not been displayed yet
      .filter(annotation => !existingIds.includes(annotation.id))
      // Check for valid coordinates
      .filter(this.shouldDisplayAnnotation)
      .map(this.createGeoJSAnnotation)
      .forEach(geoJSAnnotation => {
        this.annotationLayer.addAnnotation(geoJSAnnotation, undefined, false);
      });
  }

  drawNewConnections(existingIds: string[]) {
    const layerAnnotationIds = this.layerAnnotations.map(
      (annotation: IAnnotation) => annotation.id
    );

    this.annotationStore.annotationConnections
      .filter(
        (connection: IAnnotationConnection) =>
          !existingIds.includes(connection.id) &&
          (layerAnnotationIds.includes(connection.parentId) ||
            layerAnnotationIds.includes(connection.childId))
      )
      .forEach((connection: IAnnotationConnection) => {
        {
          const childAnnotation = this.annotationStore.annotations.find(
            (child: IAnnotation) => child.id === connection.childId
          );
          const parentAnnotation = this.annotationStore.annotations.find(
            (parent: IAnnotation) => parent.id === connection.parentId
          );
          if (
            !childAnnotation ||
            !parentAnnotation ||
            !this.shouldDisplayAnnotation(childAnnotation) ||
            !this.shouldDisplayAnnotation(parentAnnotation)
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

  createGeoJSAnnotation(annotation: IAnnotation) {
    if (!this.store.dataset) {
      return;
    }

    const anyImage = this.store.dataset?.anyImage();
    if (!anyImage) {
      return;
    }
    const options = {
      girderId: annotation.id,
      storedAnnotation: annotation,
      isHovered: annotation.id === this.hoveredAnnotationId,
      location: annotation.location,
      channel: annotation.channel,
      isSelected: false
    };

    const coordinates = this.unrolledCoordinates(annotation, anyImage);

    const newGeoJSAnnotation = geojsAnnotationFactory(
      annotation.shape,
      coordinates,
      options
    );
    newGeoJSAnnotation.options("girderId", annotation.id);

    if (annotation.id === this.hoveredAnnotationId) {
      newGeoJSAnnotation.options("isHovered", true);
    }

    if (this.isAnnotationSelected(annotation.id)) {
      newGeoJSAnnotation.options("isSelected", true);
    }

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
      const { radius, strokeWidth } = this.getAnnotationStyle(annotation);

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

    const selectLocation = {
      XY: this.xy,
      Z: this.z,
      Time: this.time
    };
    const coordinates = selectAnnotation.coordinates();
    const type = selectAnnotation.type();

    // Get general information from the map.
    // When working with pointAnnotation, unitsPerPixels is necessary to
    // compute the right value of the radius.
    const unitsPerPixel = this.getMapUnitsPerPixel();

    // Get selected annotations.
    // Only select annotations that are located at the same XY, Z and Time frames and with a visible channel
    const selectedAnnotations = this.annotations.filter(
      (annotation: IAnnotation) => {
        return (
          this.shouldDisplayAnnotationWithLocation(annotation.location) &&
          this.shouldDisplayAnnotationWithChannel(annotation.channel) &&
          this.shouldSelectAnnotation(
            type,
            coordinates,
            annotation,
            unitsPerPixel
          )
        );
      }
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

    // Save the new annotation
    this.annotationStore.addAnnotation(newAnnotation);

    this.addAnnotationConnections(newAnnotation).then(
      (connections: IAnnotationConnection[]) => {
        this.propertiesStore.handleNewAnnotation({
          newAnnotation,
          newConnections: connections
        });
      }
    );

    // Display the new annotation
    const newGeoJSAnnotation = this.createGeoJSAnnotation(newAnnotation);
    this.annotationLayer.removeAnnotation(annotation);
    this.annotationLayer.addAnnotation(newGeoJSAnnotation, undefined, false);
  }

  private async addAnnotationConnections(annotation: IAnnotation) {
    if (!this.selectedTool || !this.dataset) {
      return [];
    }
    const connectTo = this.selectedTool.values.connectTo;
    // Look for connections
    if (connectTo && connectTo.tags && connectTo.tags.length) {
      const annotations = this.annotationStore.annotations;
      // Find eligible annotations (matching tags and channel)
      const connectToChannel =
        connectTo.layer === null ? null : this.layers[connectTo.layer].channel;
      const eligibleAnnotations = annotations.filter((value: IAnnotation) => {
        if (value.id === annotation.id) {
          return false;
        }
        if (connectTo.layer !== null && value.channel !== connectToChannel) {
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

        const newConnection: IAnnotationConnection | null = await this.annotationStore.createConnection(
          {
            tags: [],
            label: "A Connection",
            parentId: closest.id,
            childId: annotation.id,
            datasetId: this.dataset.id
          }
        );
        if (newConnection) {
          this.annotationStore.addConnection(newConnection);
          this.drawGeoJSAnnotationFromConnection(
            newConnection,
            annotation,
            closest
          );
          return [newConnection];
        }
      }
    }
    return [];
  }

  handleNewROIFilter(geojsAnnotation: any) {
    if (!this.roiFilter) {
      return;
    }
    const id = this.roiFilter.id;
    this.filterStore.validateNewROIFilter(geojsAnnotation.coordinates());
    this.annotationLayer.removeAnnotation(geojsAnnotation);
  }

  refreshAnnotationMode() {
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

  handleMouseOver(evt: any) {
    if (!evt || this.selectedTool) {
      return;
    }
    let annotation = evt?.data?.annotation;
    if (!annotation && evt?.data?.length) {
      annotation = evt.data[0][2].annotation;
    }
    if (annotation && annotation.options("girderId")) {
      this.annotationStore.setHoveredAnnotationId(
        annotation.options("girderId")
      );
    }
  }

  handleMouseOff(evt: any) {
    let annotation = evt?.data?.annotation;
    if (!annotation && evt?.data?.length) {
      annotation = evt.data[0][2].annotation;
    }
    if (
      annotation &&
      annotation.options("girderId") &&
      this.hoveredAnnotationId === annotation.options("girderId")
    ) {
      this.annotationStore.setHoveredAnnotationId(null);
    }
  }

  private getMapUnitsPerPixel(): number {
    const map = this.annotationLayer.map();
    return map.unitsPerPixel(map.zoom());
  }

  handleAnnotationChange(evt: any) {
    this.annotationLayer
      .features()
      .filter((feature: any) => !feature.selectionAPI())
      .forEach((feature: any) => {
        feature.selectionAPI(true);
        feature.geoOff(geojs.event.feature.mouseon, this.handleMouseOver);
        feature.geoOff(geojs.event.feature.mouseoff, this.handleMouseOff);
        feature.geoOn(geojs.event.feature.mouseon, this.handleMouseOver);
        feature.geoOn(geojs.event.feature.mouseoff, this.handleMouseOff);
      });
    if (!this.selectedTool && !this.roiFilter) {
      return;
    }

    switch (evt.event) {
      case "geo_annotation_state":
        if (this.selectedTool) {
          if (this.selectedTool.type === "create") {
            this.addAnnotationFromGeoJsAnnotation(evt.annotation);
          } else if (this.selectedTool.type === "select") {
            this.selectAnnotations(evt.annotation);
          }
        } else if (evt.annotation) {
          this.handleNewROIFilter(evt.annotation);
        }
        break;
      default:
        break;
    }
  }

  @Watch("annotations")
  onAnnotationsChanged() {
    this.drawAnnotations();
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

  @Watch("shouldDrawTooltips")
  @Watch("tooltipOnAll")
  @Watch("tooltipOnSelected")
  @Watch("tooltipOnHovered")
  @Watch("hoveredAnnotationId")
  onDrawTooltipsChanged() {
    this.drawTooltips();
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
      .filter((annotation: any) => annotation.options("isRoiFilter"))
      .forEach((annotation: any) => {
        this.annotationLayer.removeAnnotation(annotation);
      });
    this.enabledRoiFilters.forEach((filter: IROIAnnotationFilter) => {
      const newGeoJSAnnotation = geojsAnnotationFactory("polygon", filter.roi, {
        id: filter.id,
        isRoiFilter: true
      });

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
    this.drawAnnotations();
  }

  @Watch("selectedAnnotations")
  updateSelectedAnnotationsStyle() {
    this.drawAnnotations();
  }

  mounted() {
    this.fetchAnnotations();
    this.bind();

    this.propertiesStore.fetchProperties();
    this.propertiesStore.fetchPropertyValues();
    this.filterStore.updateHistograms();
  }
}
</script>

<style lang="scss" scoped></style>
