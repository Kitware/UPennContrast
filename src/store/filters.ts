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
  IROIAnnotationFilter
} from "./model";

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

  get filteredAnnotations() {
    return annotation.annotations.filter((annotation: IAnnotation) => {
      // tag filter
      if (!this.tagFilter.enabled) {
        return true;
      }
      if (annotation.shape !== this.tagFilter.shape) {
        return false;
      }
      const hasAllTags = this.tagFilter.tags.reduce(
        (val: boolean, tag: string) => val && annotation.tags.includes(tag),
        true
      );
      if (this.tagFilter.exclusive) {
        return (
          hasAllTags &&
          annotation.tags
            .map((tag: string) => this.tagFilter.tags.includes(tag))
            .every((val: boolean) => val)
        );
      }

      if (!hasAllTags) {
        return false;
      }

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
      return matchesProperties;
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
