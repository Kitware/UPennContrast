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

import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationFilter,
  ITagAnnotationFilter,
  IPropertyAnnotationFilter,
  IROIAnnotationFilter
} from "./model";

@Module({ dynamic: true, store, name: "annotation" })
export class Annotations extends VuexModule {
  // Annotations from the current dataset and configuration
  annotations: IAnnotation[] = [];
  // Connections from the current dataset and configuration
  annotationConnections: IAnnotationConnection[] = [];

  selectedAnnotations: IAnnotation[] = [];
  activeAnnotationIds: string[] = [];

  get selectedAnnotationIds() {
    return this.selectedAnnotations.map(
      (annotation: IAnnotation) => annotation.id
    );
  }

  get inactiveAnnotationIds() {
    return this.annotations
      .map((annotation: IAnnotation) => annotation.id)
      .filter((id: string) => !this.activeAnnotationIds.includes(id));
  }

  hoveredAnnotationId: string | null = null;

  @Mutation
  public setHoveredAnnoationId(id: string | null) {
    this.hoveredAnnotationId = id;
  }

  @Mutation
  public activateAnnotations(ids: string[]) {
    this.activeAnnotationIds = [
      ...this.activeAnnotationIds,
      ...ids.filter((id: string) => !this.activeAnnotationIds.includes(id))
    ];
  }

  @Mutation
  public deactivateAnnotations(ids: string[]) {
    this.activeAnnotationIds = this.activeAnnotationIds.filter(
      (id: string) => !ids.includes(id)
    );
  }

  @Action
  public toggleActiveAnnotations(ids: string[]) {
    const toRemove = ids.filter((id: string) =>
      this.activeAnnotationIds.includes(id)
    );
    const toAdd = ids.filter(
      (id: string) => !this.activeAnnotationIds.includes(id)
    );
    this.activateAnnotations(toAdd);
    this.deactivateAnnotations(toRemove);
  }

  @Action
  public toggleActiveAnnotation(id: string) {
    this.toggleActiveAnnotations([id]);
  }

  @Action
  public activateSelectedAnnotations() {
    this.activateAnnotations(this.selectedAnnotationIds);
  }

  @Action
  public deactivateSelectedAnnotations() {
    this.deactivateAnnotations(this.selectedAnnotationIds);
  }

  @Mutation
  public setSelected(selected: IAnnotation[]) {
    this.selectedAnnotations = selected;
  }

  @Mutation
  public addAnnotation(value: IAnnotation) {
    this.annotations = [...this.annotations, value];
  }

  @Mutation
  public setAnnotations(values: IAnnotation[]) {
    this.annotations = values;
  }

  @Mutation
  public addConnection(value: IAnnotationConnection) {
    this.annotationConnections = [...this.annotationConnections, value];
  }

  @Mutation
  public setConnections(values: IAnnotationConnection[]) {
    this.annotationConnections = values;
  }

  @Mutation
  public deleteAnnotations(ids: string[]) {
    this.annotations = this.annotations.filter(
      (annotation: IAnnotation) => !ids.includes(annotation.id)
    );
  }

  @Action
  public deleteSelectedAnnotations() {
    this.deleteAnnotations(this.selectedAnnotationIds);
    this.syncAnnotations();
  }

  @Action
  public deleteInactiveAnnotations() {
    this.deleteAnnotations(this.inactiveAnnotationIds);
    this.syncAnnotations();
  }

  @Action
  // Very inefficient, but will work for now
  async syncAnnotations() {
    if (!main.dataset) {
      return;
    }
    sync.setSaving(true);
    if (!main.configuration) {
      return;
    }
    try {
      await main.api.setAnnotationsToConfiguration(
        this.annotations,
        this.annotationConnections,
        main.configuration
      );
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Action
  async fetchAnnotations() {
    this.setAnnotations([]);
    this.setConnections([]);
    if (!main.dataset || !main.configuration) {
      return;
    }
    try {
      const results = await main.api.getAnnotationsForConfiguration(
        main.configuration
      );
      if (results) {
        this.setAnnotations(results.annotations);
        this.setConnections(results.annotationConnections);
      }
    } catch (error) {
      error(error.message);
    }
  }
}

export default getModule(Annotations);
