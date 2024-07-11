import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule,
} from "vuex-module-decorators";
import store from "./root";

import main from "./index";
import sync from "./sync";
import jobs, { createProgressEventCallback } from "./jobs";

import {
  IAnnotation,
  IAnnotationConnection,
  IGeoJSPosition,
  IToolConfiguration,
  IAnnotationBase,
  IAnnotationConnectionBase,
  IWorkerInterfaceValues,
  IAnnotationComputeJob,
  IProgressInfo,
} from "./model";

import Vue, { markRaw } from "vue";
import { simpleCentroid } from "@/utils/annotation";
import { logError } from "@/utils/log";
import { IAnnotationSetup } from "@/tools/creation/templates/AnnotationConfiguration.vue";

interface IFetchingProgress {
  annotationProgress: number;
  annotationTotal: number;
  annotationDone: boolean;
  connectionProgress: number;
  connectionTotal: number;
  connectionDone: boolean;
}

@Module({ dynamic: true, store, name: "annotation" })
export class Annotations extends VuexModule {
  annotationsAPI = main.annotationsAPI;

  // Annotations from the current dataset and configuration
  annotations: IAnnotation[] = [];
  // Connections from the current dataset and configuration
  annotationConnections: IAnnotationConnection[] = [];

  annotationCentroids: { [annotationId: string]: IGeoJSPosition } = {};
  annotationIdToIdx: { [annotationId: string]: number } = {};

  selectedAnnotations: IAnnotation[] = [];
  activeAnnotationIds: string[] = [];

  progresses: IFetchingProgress[] = [];

  pendingAnnotation: IAnnotation | null = null;
  submitPendingAnnotationTimeout: number = 1;
  submitPendingAnnotation: ((submit: boolean) => void) | null = null;

  get selectedAnnotationIds() {
    return this.selectedAnnotations.map(
      (annotation: IAnnotation) => annotation.id,
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
    };
  }

  hoveredAnnotationId: string | null = null;

  @Action
  async undoOrRedo(undo: boolean) {
    // Undo the pending annotation if there is one
    if (undo && this.submitPendingAnnotation) {
      this.submitPendingAnnotation(false);
      return;
    }

    // Otherwise, call the undo/redo endpoint of the API and refetch annotations
    const datasetId = main.dataset?.id;
    if (!datasetId) {
      return;
    }
    try {
      sync.setSaving(true);
      if (undo) {
        await this.annotationsAPI.undo(datasetId);
      } else {
        await this.annotationsAPI.redo(datasetId);
      }
      this.context.dispatch("fetchAnnotations");
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error as Error);
    }
  }

  @Mutation
  public setHoveredAnnotationId(id: string | null) {
    this.hoveredAnnotationId = id;
  }

  @Mutation
  public activateAnnotations(ids: string[]) {
    this.activeAnnotationIds = [
      ...this.activeAnnotationIds,
      ...ids.filter((id: string) => !this.activeAnnotationIds.includes(id)),
    ];
  }

  @Mutation
  public deactivateAnnotations(ids: string[]) {
    this.activeAnnotationIds = this.activeAnnotationIds.filter(
      (id: string) => !ids.includes(id),
    );
  }

  @Action
  public toggleActiveAnnotations(ids: string[]) {
    const toRemove = ids.filter((id: string) =>
      this.activeAnnotationIds.includes(id),
    );
    const toAdd = ids.filter(
      (id: string) => !this.activeAnnotationIds.includes(id),
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
    if (this.selectedAnnotations.find((a) => a.id === annotation.id)) {
      return;
    }
    this.selectedAnnotations = [...this.selectedAnnotations, annotation];
  }

  @Mutation
  public selectAnnotations(selected: IAnnotation[]) {
    const selectedAnnotationIds = this.selectedAnnotations.map(
      (annotation: IAnnotation) => annotation.id,
    );
    const annotationsToAdd = selected.filter(
      (annotation) => !selectedAnnotationIds.includes(annotation.id),
    );
    this.selectedAnnotations = [
      ...this.selectedAnnotations,
      ...annotationsToAdd,
    ];
  }

  @Mutation
  public unselectAnnotation(annotation: IAnnotation) {
    const index = this.selectedAnnotations.findIndex(
      (a: IAnnotation) => a.id === annotation.id,
    );
    if (index >= 0) {
      this.selectedAnnotations.splice(index, 1);
    }
  }

  @Mutation
  public unselectAnnotations(selected: IAnnotation[]) {
    const selectedAnnotationsIds = selected.map(
      (annotation: IAnnotation) => annotation.id,
    );
    const annotationsToSelect = this.selectedAnnotations.filter(
      (annotation: IAnnotation) =>
        !selectedAnnotationsIds.includes(annotation.id),
    );
    this.selectedAnnotations = [...annotationsToSelect];
  }

  @Action
  public toggleSelected(selected: IAnnotation[]) {
    selected.forEach((annotation) => {
      if (this.selectedAnnotations.find((a) => a.id === annotation.id)) {
        this.unselectAnnotation(annotation);
      } else {
        this.selectAnnotation(annotation);
      }
    });
  }

  @Mutation
  setPendingAnnotation(annotationBase: IAnnotationBase | null) {
    if (!annotationBase) {
      this.pendingAnnotation = null;
    } else {
      this.pendingAnnotation = {
        ...annotationBase,
        id: "pendingAnnotation",
        name: null,
      };
    }
  }

  @Mutation
  setSubmitPendingAnnotationFunction(
    newSubmitFunction: ((x: boolean) => void) | null,
  ) {
    this.submitPendingAnnotation = newSubmitFunction;
  }

  @Action
  private getAnnotationSubmition(annotationBase: IAnnotationBase) {
    // If there is a pending annotation, submit it
    this.submitPendingAnnotation?.(true);

    // Set pending annotation for preview
    this.setPendingAnnotation(annotationBase);

    // Start a new timer to submit the annotation
    const timeoutId = setTimeout(() => {
      this.submitPendingAnnotation?.(true);
    }, 1000 * this.submitPendingAnnotationTimeout);

    // Create a new promise and get its "resolve" function
    let promiseResolve: (submit: boolean) => void;
    const outputPromise = new Promise<boolean>(
      (resolve) => (promiseResolve = resolve),
    );

    // This function will submit or cancel the annotation
    const newSubmitFunction = (x: boolean) => {
      this.setSubmitPendingAnnotationFunction(null);
      this.setPendingAnnotation(null);
      clearTimeout(timeoutId);
      promiseResolve(x);
    };

    this.setSubmitPendingAnnotationFunction(newSubmitFunction);

    return outputPromise;
  }

  @Action
  public async createAnnotation(
    annotationBase: IAnnotationBase,
  ): Promise<IAnnotation | null> {
    const submited = await this.getAnnotationSubmition(annotationBase);
    if (!submited) {
      return null;
    }

    sync.setSaving(true);
    const newAnnotation =
      await this.annotationsAPI.createAnnotation(annotationBase);
    sync.setSaving(false);
    return newAnnotation;
  }

  @Action
  private async addConnectionsForNewAnnotation({
    annotation,
    toolConfiguration,
  }: {
    annotation: IAnnotation;
    toolConfiguration: IToolConfiguration;
  }): Promise<IAnnotationConnection[]> {
    // Find eligible annotations (matching tags and channel)
    const connectTo = toolConfiguration.values.connectTo;
    if (!connectTo?.tags?.length) {
      return [];
    }
    const connectToTags = connectTo.tags;
    const connectToLayer = main.getLayerFromId(connectTo.layer);
    const connectToChannel = connectToLayer?.channel ?? null;

    // API call, the server creates the annotation itself
    const connections =
      (await this.createConnections({
        annotationsIds: [annotation.id],
        tags: connectToTags,
        channelId: connectToChannel,
      })) ?? [];

    // Add the annotations to the store
    connections.forEach((connection: any) => {
      this.addConnectionImpl(connection);
    });

    return connections;
  }

  @Action
  public async addAnnotationFromTool({
    coordinates,
    toolConfiguration,
    datasetId,
  }: {
    coordinates: IGeoJSPosition[];
    toolConfiguration: IToolConfiguration;
    datasetId: string;
  }): Promise<IAnnotation | null> {
    // Create the new annotation on the server
    const { location, channel } =
      await this.getAnnotationLocationFromTool(toolConfiguration);
    const { tags, shape, color } = toolConfiguration.values.annotation;
    const annotationBase: IAnnotationBase = {
      tags,
      shape,
      location,
      channel,
      coordinates,
      datasetId,
    };
    // Optional color
    if (color) {
      annotationBase.color = color;
    }
    const annotation = await this.createAnnotation(annotationBase);
    if (!annotation) {
      return null;
    }

    // Add to the store
    this.addAnnotationImpl(annotation);

    // Create the connections
    await this.addConnectionsForNewAnnotation({
      annotation,
      toolConfiguration,
    });

    return annotation;
  }

  @Mutation
  private addAnnotationImpl(value: IAnnotation) {
    this.annotations.push(value);
    Vue.set(
      this.annotationCentroids,
      value.id,
      simpleCentroid(value.coordinates),
    );
    Vue.set(this.annotationIdToIdx, value.id, this.annotations.length - 1);
  }

  @Mutation
  private setAnnotation({
    annotation,
    index,
  }: {
    annotation: IAnnotation;
    index: number;
  }) {
    Vue.set(this.annotations, index, annotation);
    Vue.set(
      this.annotationCentroids,
      annotation.id,
      simpleCentroid(annotation.coordinates),
    );
    Vue.set(this.annotationIdToIdx, annotation.id, index);
  }

  @Action
  public updateAnnotationName({ name, id }: { name: string; id: string }) {
    const annotation = this.annotations.find(
      (annotation: IAnnotation) => annotation.id === id,
    );
    if (annotation) {
      this.annotationsAPI.updateAnnotation({ ...annotation, name });
      this.setAnnotation({
        annotation: markRaw({ ...annotation, name }),
        index: this.annotations.indexOf(annotation),
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
      Vue.set(
        this.annotationCentroids,
        annotation.id,
        simpleCentroid(annotation.coordinates),
      );
      Vue.set(this.annotationIdToIdx, annotation.id, idx);
    }
  }

  @Action
  public async createConnections({
    annotationsIds,
    tags,
    channelId,
  }: {
    annotationsIds: string[];
    tags: string[];
    channelId: number | null;
  }) {
    sync.setSaving(true);
    const connections = await this.annotationsAPI.createConnections(
      annotationsIds,
      tags,
      channelId,
    );
    sync.setSaving(false);
    return connections;
  }

  @Action
  public async createAllConnections({
    parentIds,
    childIds,
    label,
    tags,
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
          datasetId: main.dataset.id,
        });
      }
    }
    const connections =
      await this.annotationsAPI.createMultipleConnections(connectionBases);
    if (connections) {
      this.addMultipleConnections(connections);
    }
    sync.setSaving(false);
    return connections || [];
  }

  @Action
  public async deleteAllConnections({
    parentIds,
    childIds,
  }: {
    parentIds: string[];
    childIds: string[];
  }) {
    const parentsSet = new Set(parentIds);
    const childrenSet = new Set(childIds);
    const connectionsToDelete = this.annotationConnections.filter(
      (connection) =>
        parentsSet.has(connection.parentId) &&
        childrenSet.has(connection.childId),
    );
    const connectionIds = connectionsToDelete.map(({ id }) => id);
    return await this.deleteConnections(connectionIds);
  }

  @Action
  public async deleteConnections(connectionIds: string[]) {
    sync.setSaving(true);
    await this.annotationsAPI.deleteMultipleConnections(connectionIds);
    this.deleteMultipleConnections(connectionIds);
    sync.setSaving(false);
    return connectionIds;
  }

  @Action
  public async createConnection(
    annotationConnectionBase: IAnnotationConnectionBase,
  ): Promise<IAnnotationConnection | null> {
    sync.setSaving(true);
    const newConnection: IAnnotationConnection | null =
      await this.annotationsAPI.createConnection(annotationConnectionBase);
    if (newConnection) {
      this.addMultipleConnections([newConnection]);
    }
    sync.setSaving(false);
    return newConnection;
  }

  @Mutation
  public addMultipleConnections(value: IAnnotationConnection[]) {
    this.annotationConnections.push(...value);
  }

  @Mutation
  private deleteMultipleConnections(connectionIds: string[]) {
    const idsSet = new Set(connectionIds);
    this.annotationConnections = this.annotationConnections.filter(
      (connection) => !idsSet.has(connection.id),
    );
  }

  @Mutation
  private addConnectionImpl(value: IAnnotationConnection) {
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
      this.annotations.filter(
        (annotation: IAnnotation) => !ids.includes(annotation.id),
      ),
    );
  }

  @Action
  public deleteSelectedAnnotations() {
    this.deleteAnnotations(this.selectedAnnotationIds);
    this.setSelected([]);
  }

  @Action
  public async tagAnnotationIds({
    annotationIds,
    tags,
  }: {
    annotationIds: string[];
    tags: string[];
  }) {
    sync.setSaving(true);
    await Promise.all(
      annotationIds
        .map((annotationId) =>
          this.annotations.findIndex(
            (annotation: IAnnotation) => annotation.id === annotationId,
          ),
        )
        .filter((annotationIndex: number) => annotationIndex !== -1)
        .map((annotationIndex: number) => {
          const annotation = this.annotations[annotationIndex];
          // Add a tag only if it doesn't exist
          const newTags = tags.reduce((newTags: string[], tag: string) => {
            if (!newTags.includes(tag)) {
              newTags.push(tag);
            }
            return newTags;
          }, annotation.tags);
          const newAnnotation = markRaw({ ...annotation, tags: newTags });
          this.setAnnotation({
            annotation: newAnnotation,
            index: annotationIndex,
          });
          return this.annotationsAPI.updateAnnotation(newAnnotation);
        }),
    );
    sync.setSaving(false);
  }

  @Action
  public tagSelectedAnnotations(tags: string[]) {
    this.tagAnnotationIds({ annotationIds: this.selectedAnnotationIds, tags });
  }

  @Mutation
  addProgress(progressObj: IFetchingProgress) {
    this.progresses.push(progressObj);
  }

  @Mutation
  removeProgress(progress: IFetchingProgress) {
    this.progresses = this.progresses.filter(
      (otherProgress) => otherProgress !== progress,
    );
  }

  @Action
  createProgresses() {
    const progressObj: IFetchingProgress = {
      annotationProgress: 0,
      annotationTotal: 0,
      annotationDone: false,
      connectionProgress: 0,
      connectionTotal: 0,
      connectionDone: false,
    };
    const annotationCallback = (progress: number, total: number) => {
      progressObj.annotationProgress = progress;
      progressObj.annotationTotal = total;
    };
    const connectionCallback = (progress: number, total: number) => {
      progressObj.connectionProgress = progress;
      progressObj.connectionTotal = total;
    };
    this.addProgress(progressObj);
    return { progress: progressObj, annotationCallback, connectionCallback };
  }

  @Action
  async fetchAnnotations() {
    this.setAnnotations([]);
    this.setConnections([]);
    if (!main.dataset || !main.configuration) {
      return;
    }
    const { progress, annotationCallback, connectionCallback } =
      await this.createProgresses();
    try {
      const annotationsPromise = this.annotationsAPI.getAnnotationsForDatasetId(
        main.dataset.id,
        annotationCallback,
      );
      const connectionsPromise = this.annotationsAPI.getConnectionsForDatasetId(
        main.dataset.id,
        connectionCallback,
      );
      annotationsPromise.finally(() => (progress.annotationDone = true));
      connectionsPromise.finally(() => (progress.connectionDone = true));
      const promises: [
        Promise<IAnnotation[]>,
        Promise<IAnnotationConnection[]>,
      ] = [annotationsPromise, connectionsPromise];
      const [annotations, connections]: [
        IAnnotation[],
        IAnnotationConnection[],
      ] = await Promise.all(promises);
      if (connections?.length) {
        this.setConnections(connections);
      } else {
        this.setConnections([]);
      }
      if (annotations?.length) {
        this.setAnnotations(annotations);
      } else {
        this.setAnnotations([]);
      }
    } catch (error) {
      this.setAnnotations([]);
      this.setConnections([]);
      logError((error as Error).message);
    } finally {
      this.removeProgress(progress);
    }
  }

  @Action
  public async computeAnnotationsWithWorker({
    tool,
    workerInterface,
    progress,
    callback,
  }: {
    tool: IToolConfiguration;
    workerInterface: IWorkerInterfaceValues;
    progress: IProgressInfo;
    callback: (success: boolean) => void;
  }) {
    if (!main.dataset || !main.configuration) {
      return null;
    }
    const datasetId = main.dataset.id;

    const { location, channel } =
      await this.getAnnotationLocationFromTool(tool);
    const tile = { XY: main.xy, Z: main.z, Time: main.time };
    const response = await this.annotationsAPI.computeAnnotationWithWorker(
      tool,
      main.dataset,
      {
        location,
        channel,
        tile,
      },
      workerInterface,
      main.layers,
      main.scales,
    );

    // Keep track of running jobs
    const jobId = response.data[0]?._id;
    if (!jobId) {
      return null;
    }
    const computeJob: IAnnotationComputeJob = {
      toolId: tool.id,
      jobId,
      datasetId,
      eventCallback: createProgressEventCallback(progress),
    };
    jobs.addJob(computeJob).then((success: boolean) => {
      this.fetchAnnotations();
      callback(success);
    });
    return computeJob;
  }

  @Action
  public getAnnotationLocationFromTool(tool: IToolConfiguration) {
    const toolAnnotation = tool.values.annotation as IAnnotationSetup;
    // Find location in the assigned layer
    const location = {
      XY: main.xy,
      Z: main.z,
      Time: main.time,
    };

    const layerId = toolAnnotation.coordinateAssignments.layer;
    const layer = layerId ? main.getLayerFromId(layerId) : null;
    const channel = layer?.channel ?? 0;
    if (layer) {
      const indexes = main.layerSliceIndexes(layer);
      if (indexes) {
        const { xyIndex, zIndex, tIndex } = indexes;
        location.XY = xyIndex;
        const assign = toolAnnotation.coordinateAssignments;
        // Values are 1 indexed, but the location uses 0 indexing
        location.Z = assign.Z.type === "layer" ? zIndex : assign.Z.value - 1;
        location.Time =
          assign.Time.type === "layer" ? tIndex : assign.Time.value - 1;
      }
    }
    return { channel, location };
  }
}

export default getModule(Annotations);
