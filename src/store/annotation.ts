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

import { IAnnotation, IAnnotationConnection, IGeoJSPoint } from "./model";

import Vue from "vue";

@Module({ dynamic: true, store, name: "annotation" })
export class Annotations extends VuexModule {
  annotationsAPI = main.annotationsAPI;

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

  @Action
  public async createAnnotation({
    tags,
    shape,
    channel,
    location,
    coordinates,
    datasetId
  }: {
    tags: string[];
    shape: string;
    channel: number;
    location: { XY: number; Z: number; Time: number };
    coordinates: IGeoJSPoint[];
    datasetId: string;
  }): Promise<IAnnotation | null> {
    sync.setSaving(true);
    const newAnnotation: IAnnotation | null = await this.annotationsAPI.createAnnotation(
      tags,
      shape,
      channel,
      location,
      coordinates,
      datasetId
    );
    sync.setSaving(false);
    return newAnnotation;
  }

  @Mutation
  public addAnnotation(value: IAnnotation) {
    this.annotations = [...this.annotations, value];
  }

  @Mutation
  public setAnnotation({
    annotation,
    index
  }: {
    annotation: IAnnotation;
    index: number;
  }) {
    Vue.set(this.annotations, index, annotation);
  }

  @Action
  public updateAnnotationName({ name, id }: { name: string; id: string }) {
    const annotation = this.annotations.find(
      (annotation: IAnnotation) => annotation.id === id
    );
    if (annotation) {
      this.annotationsAPI.updateAnnotation({ ...annotation, name });
      this.setAnnotation({
        annotation: { ...annotation, name },
        index: this.annotations.indexOf(annotation)
      });
    }
  }

  @Mutation
  public setAnnotations(values: IAnnotation[]) {
    this.annotations = values;
  }

  @Action
  public async createConnection({
    parentId,
    childId,
    label,
    tags,
    datasetId
  }: {
    parentId: string;
    childId: string;
    label: string;
    tags: string[];
    datasetId: string;
  }): Promise<IAnnotationConnection | null> {
    sync.setSaving(true);
    const newConnection: IAnnotationConnection | null = await this.annotationsAPI.createConnection(
      parentId,
      childId,
      label,
      tags,
      datasetId
    );
    sync.setSaving(false);
    return newConnection;
  }

  @Mutation
  public addConnection(value: IAnnotationConnection) {
    this.annotationConnections = [...this.annotationConnections, value];
  }

  @Mutation
  public setConnections(values: IAnnotationConnection[]) {
    this.annotationConnections = values;
  }

  @Action
  public async deleteAnnotations(ids: string[]) {
    sync.setSaving(true);
    await Promise.all(ids.map(id => this.annotationsAPI.deleteAnnotation(id)));
    sync.setSaving(false);

    this.setAnnotations(
      this.annotations.filter(
        (annotation: IAnnotation) => !ids.includes(annotation.id)
      )
    );
  }

  @Action
  public deleteSelectedAnnotations() {
    this.deleteAnnotations(this.selectedAnnotationIds);
    this.setSelected([]);
  }

  @Action
  public deleteInactiveAnnotations() {
    this.deleteAnnotations(this.inactiveAnnotationIds);
  }

  @Action
  async fetchAnnotations() {
    this.setAnnotations([]);
    this.setConnections([]);
    if (!main.dataset || !main.configuration) {
      return;
    }
    try {
      const promises: [
        Promise<IAnnotation[]>,
        Promise<IAnnotationConnection[]>
      ] = [
        this.annotationsAPI.getAnnotationsForDatasetId(main.dataset.id),
        this.annotationsAPI.getConnectionsForDatasetId(main.dataset.id)
      ];
      Promise.all(promises).then(
        ([annotations, connections]: [
          IAnnotation[],
          IAnnotationConnection[]
        ]) => {
          if (connections?.length) {
            this.setConnections(connections);
          }
          if (annotations?.length) {
            this.setAnnotations(annotations);
          }
        }
      );
    } catch (error) {
      error(error.message);
    }
  }
}

export default getModule(Annotations);
