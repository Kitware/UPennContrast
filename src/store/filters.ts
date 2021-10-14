import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import main from "./index";
import sync from "./sync";
import annotation from "./annotation";
import properties from "./properties";

import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationFilter,
  ITagAnnotationFilter,
  IPropertyAnnotationFilter,
  IROIAnnotationFilter,
  IIdAnnotationFilter,
  IGeoJSPoint
} from "./model";

import geo from "geojs";

@Module({ dynamic: true, store, name: "filters" })
export class Filters extends VuexModule {
  // Annotation browser filters
  tagFilter: ITagAnnotationFilter = {
    id: "tagFilter",
    exclusive: false,
    enabled: true,
    tags: [],
    shape: "polygon"
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

  filterIds: string[] = [];

  @Mutation
  addFilterId(id: string) {
    if (!this.filterIds.includes(id)) {
      this.filterIds = [...this.filterIds, id];
    }
  }

  @Mutation
  removeFilterId(id: string) {
    if (this.filterIds.includes(id)) {
      this.filterIds = this.filterIds.filter(testId => id !== testId);
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
      id: `ROI Filter ${this.roiFilters.length}`,
      exclusive: true,
      enabled: true,
      roi: []
    };
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
    return annotation.annotations.filter((annotation: IAnnotation) => {
      // tag filter
      if (this.tagFilter.enabled && annotation.shape !== this.tagFilter.shape) {
        return false;
      }

      // Selection filter
      if (
        this.selectionFilter.enabled &&
        !this.selectionFilter.annotationIds.includes(annotation.id)
      ) {
        return false;
      }

      // Tag filter
      if (this.tagFilter.enabled) {
        const hasAllTags = this.tagFilter.tags.reduce(
          (val: boolean, tag: string) => val && annotation.tags.includes(tag),
          true
        );
        if (
          hasAllTags &&
          this.tagFilter.exclusive &&
          !annotation.tags
            .map((tag: string) => this.tagFilter.tags.includes(tag))
            .every((val: boolean) => val)
        ) {
          return false;
        }

        if (!hasAllTags) {
          return false;
        }
      }

      // Property filters
      const matchesProperties = this.propertyFilters
        .filter((filter: IPropertyAnnotationFilter) => filter.enabled)
        .reduce((val: boolean, filter: IPropertyAnnotationFilter) => {
          if (!val) {
            return false;
          }
          const index = -1; // Temporary until we can get property values from girder
          if (index === -1) {
            return false;
          }
          const value = 0; // Temporary
          return value >= filter.range.min && value <= filter.range.max;
        }, true);

      if (!matchesProperties) {
        return false;
      }

      // ROI filters
      const roiFilters = this.roiFilters.filter(
        (filter: IROIAnnotationFilter) => filter.enabled
      );
      if (!roiFilters.length) {
        return true;
      }
      const isInROI = roiFilters.reduce(
        (isIn, filter: IROIAnnotationFilter) => {
          return (
            isIn ||
            annotation.coordinates.reduce(
              (onePointIn: boolean, point: IGeoJSPoint) =>
                onePointIn || geo.util.pointInPolygon(point, filter.roi),
              false
            )
          );
        },
        false
      );

      return isInROI;
    });
  }

  @Mutation
  public updatePropertyFilter(value: IPropertyAnnotationFilter) {
    // TODO: keep order, or sort alphabetically in interface
    this.propertyFilters = [
      ...this.propertyFilters.filter(
        (filter: IPropertyAnnotationFilter) =>
          filter.propertyId !== value.propertyId
      ),
      value
    ];
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
}

export default getModule(Filters);
