import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationProperty,
  IPropertyComputeJob
} from "./model";

import Vue from "vue";

import main from "./index";

import { logError } from "@/utils/log";
import filters from "./filters";

const jobStates = {
  inactive: 0,
  queued: 1,
  running: 2,
  success: 3,
  error: 4,
  cancelled: 5,
  cancelling: 824
};

@Module({ dynamic: true, store, name: "properties" })
export class Properties extends VuexModule {
  propertiesAPI = main.propertiesAPI;

  properties: IAnnotationProperty[] = [];

  annotationListIds: string[] = [];

  notificationSource: EventSource | null = null;
  latestNotificationTime: number = 0;

  propertyValues: {
    [annotationId: string]: { [propertyId: string]: number };
  } = {};

  runningJobs: IPropertyComputeJob[] = [];

  @Mutation
  updatePropertyValues(values: {
    [annotationId: string]: { [propertyId: string]: number };
  }) {
    // TODO(performance): merge instead
    this.propertyValues = values;
  }

  @Mutation
  replaceProperty(property: IAnnotationProperty) {
    const find = (prop: IAnnotationProperty) => prop.id === property.id;
    const prev = this.properties.find(find);
    if (!prev) {
      return;
    }
    Vue.set(this.properties, this.properties.indexOf(prev), property);
  }

  get getPropertyById() {
    return (id: string) => {
      const find = (prop: IAnnotationProperty) => prop.id === id;
      return this.properties.find(find) || null;
    };
  }

  @Action
  disableProperty(property: IAnnotationProperty) {
    this.replaceProperty({ ...property, enabled: false });
  }

  @Action
  enableProperty(property: IAnnotationProperty) {
    this.replaceProperty({ ...property, enabled: true, computed: false });

    const newProp = this.getPropertyById(property.id);
    if (newProp) {
      this.computeProperty({ property: newProp, annotationIds: [] });
    }
  }

  @Mutation
  addAnnotationListId(id: string) {
    if (!this.annotationListIds.includes(id)) {
      this.annotationListIds = [...this.annotationListIds, id];
    }
  }

  @Mutation
  removeAnnotationListId(id: string) {
    if (this.annotationListIds.includes(id)) {
      this.annotationListIds = this.annotationListIds.filter(
        testId => id !== testId
      );
    }
  }

  @Mutation
  addJob(job: IPropertyComputeJob) {
    this.runningJobs = [...this.runningJobs, job];
  }

  @Mutation
  removeJob(jobId: string) {
    this.runningJobs = this.runningJobs.filter(
      (job: IPropertyComputeJob) => job.jobId !== jobId
    );
  }

  get isJobRunningForProperty() {
    return (propertyId: string) =>
      this.runningJobs.some(
        (job: IPropertyComputeJob) => job.propertyId === propertyId
      );
  }

  @Action
  async computeProperty({
    property,
    annotationIds = []
  }: {
    property: IAnnotationProperty;
    annotationIds: string[];
  }) {
    if (!this.isSubscribedToNotifications) {
      this.initializeNotificationSubscription();
    }

    if (
      !property.enabled ||
      !main.dataset?.id ||
      !main.configuration?.view?.layers
    ) {
      return;
    }

    // Get channel from layer
    const layers = main.configuration.view.layers;
    let channel = null;
    if (property.layer) {
      const layer = layers[property.layer];
      if (layer) {
        channel = layer.channel;
      }
    }
    this.propertiesAPI
      .computeProperty(property.name, main.dataset.id, {
        ...property,
        annotationIds: annotationIds.length ? annotationIds : undefined,
        channel
      })
      .then((response: any) => {
        // Keep track of running jobs
        const job = response.data[0];
        if (!job) {
          return;
        }
        if (job && job._id) {
          this.addJob({
            jobId: job._id,
            propertyId: property.id,
            annotationIds,
            datasetId: main.dataset!.id
          });
        }
      });
  }

  get isSubscribedToNotifications() {
    return !!this.notificationSource;
  }

  @Mutation
  setNotificationSource(source: EventSource | null) {
    this.notificationSource = source;
  }

  @Mutation
  setLatestNotificationTime(time: number) {
    this.latestNotificationTime = time;
  }

  @Action
  async handleJobEvent(event: MessageEvent) {
    let data: any;
    try {
      data = window.JSON.parse(event.data);
    } catch (error) {
      logError("Invalid event JSON");
      return;
    }
    const notificationTime = data._girderTime;
    if (notificationTime <= this.latestNotificationTime) {
      return;
    }
    this.setLatestNotificationTime(notificationTime);

    const jobData = data.data;
    const jobTask = this.runningJobs.find(
      (job: IPropertyComputeJob) => job.jobId === jobData._id
    );
    if (jobTask) {
      const status = jobData.status;
      if (
        [jobStates.cancelled, jobStates.success, jobStates.error].includes(
          status
        )
      ) {
        if (status === jobStates.success) {
          this.fetchPropertyValues();
          filters.updateHistograms();
        } else {
          logError(
            `Compute job with id ${jobTask.jobId} for property ${jobTask.propertyId} failed or was cancelled`
          );
        }
        this.removeJob(jobTask.jobId);
      }
    }
  }

  @Action
  async initializeNotificationSubscription() {
    if (this.notificationSource) {
      this.closeNotificationSubscription();
    }
    const notificationSource: EventSource | null = this.propertiesAPI.subscribeToNotifications();
    if (notificationSource) {
      notificationSource.onmessage = this.handleJobEvent;
    }
  }

  @Action
  async closeNotificationSubscription() {
    if (this.notificationSource) {
      this.notificationSource.close();
      this.notificationSource = null;
    }
  }

  @Mutation
  setProperties(properties: IAnnotationProperty[]) {
    this.properties = [...properties];
  }
  @Action
  async fetchProperties() {
    const properties = await this.propertiesAPI.getProperties();
    if (properties && properties.length) {
      this.setProperties(properties);
    }
  }

  @Action
  async handleNewAnnotation({
    newAnnotation,
    newConnections
  }: {
    newAnnotation: IAnnotation;
    newConnections: IAnnotationConnection[];
  }) {
    // We also want to recompute properties for connected annotations
    const relatedIds: string[] = [newAnnotation.id];
    newConnections.forEach((connection: IAnnotationConnection) => {
      if (!relatedIds.includes(connection.childId)) {
        relatedIds.push(connection.childId);
      }
      if (!relatedIds.includes(connection.parentId)) {
        relatedIds.push(connection.parentId);
      }
    });

    // For all enabled and valid properties, send a compute request with these annotations
    this.properties
      .filter((property: IAnnotationProperty) => property.enabled)
      .filter(
        (property: IAnnotationProperty) =>
          !property.shape || property.shape === newAnnotation.shape
      )
      .forEach((property: IAnnotationProperty) =>
        this.computeProperty({ property, annotationIds: relatedIds })
      );
  }

  @Action
  async fetchPropertyValues() {
    if (!main.dataset?.id) {
      return;
    }
    const values = await this.propertiesAPI.getPropertyValues(main.dataset.id);
    this.updatePropertyValues(values);
  }

  @Action
  async createProperty(property: IAnnotationProperty) {
    const newProperty = await this.propertiesAPI.createProperty(property);
    if (newProperty) {
      this.setProperties([...this.properties, newProperty]);
    }
  }
}

export default getModule(Properties);
