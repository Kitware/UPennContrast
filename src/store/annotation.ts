/* eslint-disable prettier/prettier */
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
import jobs from "./jobs";

import {
  IAnnotation,
  IAnnotationConnection,
  IGeoJSPoint,
  IToolConfiguration,
  IAnnotationBase,
  IAnnotationConnectionBase,
  IWorkerInterfaceValues,
  IComputeJob
} from "./model";

import Vue, { markRaw } from "vue";
import { simpleCentroid } from "@/utils/annotation";

function markElementsRaw<T extends object>(list: T[]) {
  for (let i = 0; i < list.length; ++i) {
    markRaw(list[i]);
  }
  return list;
}

@Module({ dynamic: true, store, name: "annotation" })
export class Annotations extends VuexModule {
  annotationsAPI = main.annotationsAPI;

  // Annotations from the current dataset and configuration
  annotations: IAnnotation[] = [];
  // Connections from the current dataset and configuration
  annotationConnections: IAnnotationConnection[] = [];

  
  annotationCentroids: { [annotationId: string]: IGeoJSPoint } = {};
  annotationIdToIdx: { [annotationId: string]: number } = {};

  selectedAnnotations: IAnnotation[] = [];
  activeAnnotationIds: string[] = [];

  get selectedAnnotationIds() {
    return this.selectedAnnotations.map(
      (annotation: IAnnotation) => annotation.id
    );
  }

  get isAnnotationSelected() {
    const annotationIdsSet = new Set(this.selectedAnnotationIds);
    return (annotationId: string) => annotationIdsSet.has(annotationId);
  }

  get inactiveAnnotationIds() {
    return this.annotations
      .map((annotation: IAnnotation) => annotation.id)
      .filter((id: string) => !this.activeAnnotationIds.includes(id));
  }

  get getAnnotationFromId() {
    return (annotationId: string) => {
      const idx = this.annotationIdToIdx[annotationId];
      return idx === undefined ? undefined : this.annotations[idx];
    }
  }

  hoveredAnnotationId: string | null = null;

  @Mutation
  public setHoveredAnnotationId(id: string | null) {
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

  @Mutation
  public setSelected(selected: IAnnotation[]) {
    this.selectedAnnotations = selected;
  }

  @Mutation
  public selectAnnotation(annotation: IAnnotation) {
    if (this.selectedAnnotations.find(a => a.id === annotation.id)) {
      return;
    }
    this.selectedAnnotations = [...this.selectedAnnotations, annotation];
  }

  @Mutation
  public selectAnnotations(selected: IAnnotation[]) {
    const selectedAnnotationIds = this.selectedAnnotations.map((annotation: IAnnotation) => annotation.id);
    const annotationsToAdd = selected.filter(annotation => !selectedAnnotationIds.includes(annotation.id));
    this.selectedAnnotations = [...this.selectedAnnotations, ...annotationsToAdd];
  }

  @Mutation
  public unselectAnnotation(annotation: IAnnotation) {
    const index = this.selectedAnnotations.findIndex((a: IAnnotation) => a.id === annotation.id);
    if (index >= 0) {
      this.selectedAnnotations.splice(index, 1);
    }
  }

  @Mutation
  public unselectAnnotations(selected: IAnnotation[]) {
    const selectedAnnotationsIds = selected.map((annotation: IAnnotation) => annotation.id);
    const annotationsToSelect = this.selectedAnnotations.filter(
      (annotation: IAnnotation) => !selectedAnnotationsIds.includes(annotation.id)
    );
    this.selectedAnnotations = [...annotationsToSelect];
  }

  @Action
  public toggleSelected(selected: IAnnotation[]) {
    selected.forEach(annotation => {
      if (this.selectedAnnotations.find(a => a.id === annotation.id)) {
        this.unselectAnnotation(annotation);
      } else {
        this.selectAnnotation(annotation);
      }
    });
  }

  @Action
  public async createAnnotation(annotationBase: IAnnotationBase): Promise<IAnnotation | null> {
    sync.setSaving(true);
    const newAnnotation: IAnnotation | null = await this.annotationsAPI.createAnnotation(annotationBase);
    sync.setSaving(false);
    return newAnnotation;
  }

  @Mutation
  public addAnnotation(value: IAnnotation) {
    this.annotations.push(markRaw(value));
    Vue.set(this.annotationCentroids, value.id, simpleCentroid(value.coordinates));
    Vue.set(this.annotationIdToIdx, value.id, this.annotations.length - 1);
  }

  @Mutation
  private setAnnotation({
    annotation,
    index
  }: {
    annotation: IAnnotation;
    index: number;
  }) {
    Vue.set(this.annotations, index, markRaw(annotation));
    Vue.set(this.annotationCentroids, annotation.id, simpleCentroid(annotation.coordinates));
    Vue.set(this.annotationIdToIdx, annotation.id, index);
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
    const nAnnotations = values.length;
    // Check if annotations are the same
    if (nAnnotations === this.annotations.length) {
      let equals = true;
      for (let i = 0; i < nAnnotations; ++i) {
        if (values[i].id !== this.annotations[i].id) {
          equals = false;
          break;
        }
      }
      if (equals) {
        return;
      }
    }
    this.annotations = values;
    this.annotationCentroids = {};
    this.annotationIdToIdx = {};
    for (let idx = 0; idx < this.annotations.length; ++idx) {
      const annotation = this.annotations[idx];
      Vue.set(this.annotationCentroids, annotation.id, simpleCentroid(annotation.coordinates));
      Vue.set(this.annotationIdToIdx, annotation.id, idx);
    }
  }

  @Action
  public async createConnections({
    annotationsIds,
    tags,
    channelId
  }: {
    annotationsIds: string[];
    tags: string[];
    channelId: number | null;
  }) {
    sync.setSaving(true);
    const connections = await this.annotationsAPI.createConnections(
      annotationsIds,
      tags,
      channelId
    );
    sync.setSaving(false);
    return connections;
  }

  @Action
  public async createAllConnections({
    parentIds, childIds, label, tags
  }: {
    parentIds: string[];
    childIds: string[];
    label: string;
    tags: string[];
  }) {
    if (!main.dataset) {
      return [];
    }
    sync.setSaving(true);
    const connectionBases: IAnnotationConnectionBase[] = [];
    for (const parentId of parentIds) {
      for (const childId of childIds) {
        connectionBases.push({
          label,
          tags,
          parentId,
          childId,
          datasetId: main.dataset.id
        });
      }
    }
    const connections = await this.annotationsAPI.createMultipleConnections(connectionBases);
    if (connections) {
      this.addMultipleConnections(connections);
    }
    sync.setSaving(false);
    return connections || [];
  }

  @Action
  public async deleteAllConnections({
    parentIds, childIds
  }: {
    parentIds: string[];
    childIds: string[];
  }) {
    sync.setSaving(true);
    const parentsSet = new Set(parentIds);
    const childrenSet = new Set(childIds);
    const connectionsToDelete = this.annotationConnections.filter(connection => parentsSet.has(connection.parentId) && childrenSet.has(connection.childId));
    await this.annotationsAPI.deleteMultipleConnections(connectionsToDelete.map(connection => connection.id));
    this.deleteMultipleConnections(connectionsToDelete.map(connection => connection.id));
    sync.setSaving(false);
    return connectionsToDelete;
  }

  @Action
  public async createConnection(annotationConnectionBase: IAnnotationConnectionBase): Promise<IAnnotationConnection | null> {
    sync.setSaving(true);
    const newConnection: IAnnotationConnection | null = await this.annotationsAPI.createConnection(annotationConnectionBase);
    sync.setSaving(false);
    return newConnection;
  }

  @Mutation
  public addMultipleConnections(value: IAnnotationConnection[]) {
    this.annotationConnections.push(...value);
  }

  public deleteMultipleConnections(connectionIds: string[]) {
    const idsSet = new Set(connectionIds);
    this.annotationConnections = this.annotationConnections.filter((connection) => !idsSet.has(connection.id));
  }

  @Mutation
  public addConnection(value: IAnnotationConnection) {
    this.annotationConnections.push(value);
  }

  @Mutation
  public setConnections(values: IAnnotationConnection[]) {
    this.annotationConnections = values;
  }

  @Action
  public async deleteAnnotations(ids: string[]) {
    sync.setSaving(true);
    await this.annotationsAPI.deleteMultipleAnnotations(ids);
    sync.setSaving(false);

    this.setAnnotations(
      markElementsRaw(this.annotations.filter(
        (annotation: IAnnotation) => !ids.includes(annotation.id)
      ))
    );
  }

  @Action
  public deleteSelectedAnnotations() {
    this.deleteAnnotations(this.selectedAnnotationIds);
    this.setSelected([]);
  }

  @Action
  public async tagAnnotationIds({ annotationIds, tags }: { annotationIds: string[], tags: string[] }) {
    sync.setSaving(true);
    await Promise.all(
      annotationIds
        .map(annotationId => this.annotations.findIndex((annotation: IAnnotation) => annotation.id === annotationId))
        .filter((annotationIndex: number) => annotationIndex !== -1)
        .map((annotationIndex: number) => {
          const annotation = this.annotations[annotationIndex];
          // Add a tag only if it doesn't exist
          const newTags = tags.reduce(
            (newTags: string[], tag: string) => {
              if (!newTags.includes(tag)) {
                newTags.push(tag)
              }
              return newTags;
            },
            annotation.tags
          );
          const newAnnotation = { ...annotation, tags: newTags };
          this.setAnnotation({
            annotation: newAnnotation,
            index: annotationIndex
          });
          return this.annotationsAPI.updateAnnotation(newAnnotation);
        })
    );
    sync.setSaving(false);
  }

  @Action
  public tagSelectedAnnotations(tags: string[]) {
    this.tagAnnotationIds({ annotationIds: this.selectedAnnotationIds, tags });
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
          // eslint-disable-next-line prettier/prettier
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
          } else {
            this.setConnections([]);
          }
          if (annotations?.length) {
            this.setAnnotations(markElementsRaw(annotations));
          } else {
            this.setAnnotations([]);
          }
        }
      );
    } catch (error) {
      this.setAnnotations([]);
      this.setConnections([]);
      error(error.message);
    }
  }

  @Action
  public async computeAnnotationsWithWorker({
    tool,
    workerInterface,
    callback
  }: {
    tool: IToolConfiguration;
    workerInterface: IWorkerInterfaceValues;
    callback: (success: boolean) => void;
  }) {
    if (!main.dataset || !main.configuration) {
      return null;
    }
    const datasetId = main.dataset.id;

    const { location, channel } = await this.getAnnotationLocationFromTool(
      tool
    );
    const tile = { XY: main.xy, Z: main.z, Time: main.time };
    const response = await this.annotationsAPI.computeAnnotationWithWorker(
      tool,
      datasetId,
      {
        location,
        channel,
        tile
      },
      workerInterface
    );

    // Keep track of running jobs
    const jobId = response.data[0]?._id;
    if (!jobId) {
      return null;
    }
    const computeJob: IComputeJob = {
      jobId,
      datasetId,
      callback: (success: boolean) => {
        this.fetchAnnotations();
        callback(success);
      }
    };
    jobs.addJob(computeJob);
    return computeJob;
  }

  @Action
  public getAnnotationLocationFromTool(tool: IToolConfiguration) {
    const toolAnnotation = tool.values.annotation;
    // Find location in the assigned layer
    const location = {
      XY: main.xy,
      Z: main.z,
      Time: main.time
    };
    const layers = main.layers;
    if (!layers) {
      return { location, channel: 0 };
    }

    const layer = layers[toolAnnotation.coordinateAssignments.layer];
    const channel = layer.channel;
    const assign = toolAnnotation.coordinateAssignments;
    if (layer) {
      const indexes = main.layerSliceIndexes(layer);
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
    return { channel, location };
  }
}

export default getModule(Annotations);
