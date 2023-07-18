import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import main from "./index";
import annotation from "./annotation";
import properties from "./properties";

import { tagFilterFunction } from "@/utils/annotation";

import {
  IAnnotation,
  ITagAnnotationFilter,
  IPropertyAnnotationFilter,
  IROIAnnotationFilter,
  IIdAnnotationFilter,
  IGeoJSPoint,
  IShapeAnnotationFilter,
  AnnotationShape,
  TPropertyHistogram
} from "./model";

import geo from "geojs";
import {
  arePathEquals,
  createPathStringFromPathArray,
  findIndexOfPath,
  getValueFromObjectAndPath
} from "@/utils/paths";

type TFilterHistograms = {
  [joinedPropertyPath: string]: TPropertyHistogram;
};

@Module({ dynamic: true, store, name: "filters" })
export class Filters extends VuexModule {
  // Annotation browser filters
  tagFilter: ITagAnnotationFilter = {
    id: "tagFilter",
    exclusive: false,
    enabled: false,
    tags: []
  };

  shapeFilter: IShapeAnnotationFilter = {
    id: "shapeFilter",
    enabled: false,
    exclusive: true,
    shape: AnnotationShape.Point
  };

  propertyFilters: IPropertyAnnotationFilter[] = [];

  roiFilters: IROIAnnotationFilter[] = [];
  emptyROIFilter: IROIAnnotationFilter | null = null;

  selectionFilter: IIdAnnotationFilter = {
    enabled: false,
    exclusive: true,
    id: "selection",
    annotationIds: []
  };

  filterPaths: string[][] = [];

  histograms: TFilterHistograms = {};

  @Mutation
  togglePropertyPathFiltering(path: string[]) {
    const pathIdx = findIndexOfPath(path, this.filterPaths);
    if (pathIdx < 0) {
      this.filterPaths.push(path);
    } else {
      this.filterPaths.splice(pathIdx, 1);
    }
  }

  @Mutation
  addSelectionAsFilter() {
    const selection = annotation.selectedAnnotations.map(
      (value: IAnnotation) => value.id
    );
    this.selectionFilter = {
      enabled: true,
      exclusive: true,
      id: "selection",
      annotationIds: selection
    };
  }

  @Mutation
  clearSelection() {
    this.selectionFilter = {
      enabled: false,
      exclusive: true,
      id: "selection",
      annotationIds: []
    };
  }

  @Mutation
  newROIFilter() {
    this.emptyROIFilter = {
      id: `Region Filter ${this.roiFilters.length}`,
      exclusive: true,
      enabled: true,
      roi: []
    };
  }

  @Mutation
  removeROIFilter(id: string) {
    {
      this.roiFilters = this.roiFilters
        .filter((filter: IROIAnnotationFilter) => filter.id !== id)
        .map((filter: IROIAnnotationFilter, index) => ({
          ...filter,
          id: `Region Filter ${index}`
        }));
    }
  }

  @Mutation
  validateNewROIFilter(roi: IGeoJSPoint[]) {
    if (!this.emptyROIFilter) {
      return;
    }
    this.roiFilters = [...this.roiFilters, { ...this.emptyROIFilter, roi }];
    this.emptyROIFilter = null;
  }

  @Mutation
  cancelROISelection() {
    this.emptyROIFilter = null;
  }

  @Mutation
  toggleRoiFilterEnabled(id: string) {
    const filter = this.roiFilters.find(
      (filter: IROIAnnotationFilter) => filter.id === id
    );
    if (filter) {
      this.roiFilters = [
        ...this.roiFilters.filter(
          (value: IROIAnnotationFilter) => value.id !== id
        ),
        { ...filter, enabled: !filter.enabled }
      ];
    }
  }

  get filteredAnnotations() {
    const shapeFilter = this.shapeFilter;
    const selectionFilter = this.selectionFilter;
    const tagFilter = this.tagFilter;
    const propertyFilters = this.propertyFilters;
    const enabledPropertyFilters = propertyFilters.filter(
      (filter: IPropertyAnnotationFilter) => filter.enabled
    );
    const roiFilters = this.roiFilters;
    const enabledRoiFilters = roiFilters.filter(
      (filter: IROIAnnotationFilter) => filter.enabled
    );
    return annotation.annotations.filter((annotation: IAnnotation) => {
      // shape filter
      if (shapeFilter.enabled && annotation.shape !== shapeFilter.shape) {
        return false;
      }

      // Selection filter
      if (
        selectionFilter.enabled &&
        !selectionFilter.annotationIds.includes(annotation.id)
      ) {
        return false;
      }

      // Tag filter
      if (
        tagFilter.enabled &&
        !tagFilterFunction(annotation.tags, tagFilter.tags, tagFilter.exclusive)
      ) {
        return false;
      }

      // Property filters
      const propertyValues = properties.propertyValues[annotation.id] || {};
      const matchesProperties = enabledPropertyFilters.every(
        (filter: IPropertyAnnotationFilter) => {
          const value = getValueFromObjectAndPath(
            propertyValues,
            filter.propertyPath
          );
          return (
            typeof value === "number" &&
            value >= filter.range.min &&
            value <= filter.range.max
          );
        }
      );
      if (!matchesProperties) {
        return false;
      }

      // ROI filters
      const isInROI =
        enabledRoiFilters.length === 0 ||
        enabledRoiFilters.some((filter: IROIAnnotationFilter) =>
          annotation.coordinates.some((point: IGeoJSPoint) =>
            geo.util.pointInPolygon(point, filter.roi)
          )
        );
      return isInROI;
    });
  }

  get filteredAnnotationIdToIdx() {
    const idToIdx: Map<string, number> = new Map();
    const annotations = this.filteredAnnotations;
    for (let i = 0; i < annotations.length; ++i) {
      idToIdx.set(annotations[i].id, i);
    }
    return idToIdx;
  }

  @Mutation
  public updatePropertyFilter(value: IPropertyAnnotationFilter) {
    this.propertyFilters = [
      ...this.propertyFilters.filter(
        (filter: IPropertyAnnotationFilter) =>
          !arePathEquals(filter.propertyPath, value.propertyPath)
      ),
      value
    ];
  }

  @Mutation
  public setShapeFilter(filter: IShapeAnnotationFilter) {
    this.shapeFilter = filter;
  }

  @Mutation
  public setTagFilter(filter: ITagAnnotationFilter) {
    this.tagFilter = filter;
  }

  @Mutation
  public addTagToTagFilter(tag: string) {
    if (this.tagFilter.tags.includes(tag)) {
      return;
    }
    this.tagFilter = Object.assign({}, this.tagFilter, {
      tags: [...this.tagFilter.tags, tag]
    });
  }

  get getHistogram() {
    return (path: string[]): TPropertyHistogram | null => {
      const key = createPathStringFromPathArray(path);
      return this.histograms[key] || null;
    };
  }

  @Mutation
  public setPropertyHistograms(histograms: TFilterHistograms) {
    this.histograms = histograms;
  }

  @Action
  async updateHistograms() {
    const dataset = main.dataset;
    if (!dataset) {
      this.setPropertyHistograms({});
      return;
    }
    const histograms: TFilterHistograms = {};
    const promises = this.filterPaths.map((path: string[]) =>
      properties.propertiesAPI
        .getPropertyHistogram(dataset.id, path)
        .then((histogram: TPropertyHistogram) => {
          const key = createPathStringFromPathArray(path);
          histograms[key] = histogram;
        })
    );
    Promise.all(promises).then(() => this.setPropertyHistograms(histograms));
  }
}

export default getModule(Filters);
