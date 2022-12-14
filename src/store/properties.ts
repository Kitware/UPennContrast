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
  IPropertyComputeJob,
  IWorkerInterface,
  IToolConfiguration,
  IWorkerImageList
} from "./model";

import Vue from "vue";

import main from "./index";

import { logError } from "@/utils/log";
import filters from "./filters";
import annotation from "./annotation";
import jobs from "./jobs";

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

  propertyValues: {
    [annotationId: string]: { [propertyId: string]: number };
  } = {};

  workerImageList: IWorkerImageList = {};
  workerInterfaces: { [image: string]: IWorkerInterface } = {};
  workerPreviews: { [image: string]: { text: string; image: string } } = {};
  displayWorkerPreview = true;

  get getWorkerInterface() {
    return (image: string) => this.workerInterfaces[image];
  }

  get getWorkerPreview() {
    return (image: string) => this.workerPreviews[image];
  }

  @Mutation
  setWorkerPreview({
    image,
    workerPreview
  }: {
    image: string;
    workerPreview: { text: string; image: string };
  }) {
    this.workerPreviews = {
      ...this.workerPreviews,
      [image]: workerPreview
    };
  }
  @Action
  async fetchWorkerPreview(image: string) {
    const workerPreview = await this.propertiesAPI.getWorkerPreview(image);
    this.setWorkerPreview({ image, workerPreview });
  }
  @Mutation
  setWorkerInterface({
    image,
    workerInterface
  }: {
    image: string;
    workerInterface: IWorkerInterface;
  }) {
    this.workerInterfaces = {
      ...this.workerInterfaces,
      [image]: workerInterface
    };
  }

  @Mutation
  setDisplayWorkerPreview(value: boolean) {
    this.displayWorkerPreview = value;
  }

  @Action
  async fetchWorkerInterface(image: string) {
    const workerInterface = await this.propertiesAPI.getWorkerInterface(image);
    this.setWorkerInterface({ image, workerInterface });
  }

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
  enableProperty({
    property,
    workerInterface,
    callback
  }: {
    property: IAnnotationProperty;
    workerInterface: any;
    callback: (success: boolean) => void;
  }) {
    this.replaceProperty({ ...property, enabled: true, computed: false });

    const newProp = this.getPropertyById(property.id);
    if (newProp) {
      this.computeProperty({
        property: newProp,
        annotationIds: [],
        workerInterface,
        callback
      });
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

  @Action
  async computeProperty({
    property,
    annotationIds = [],
    workerInterface = {},
    callback = () => {}
  }: {
    property: IAnnotationProperty;
    annotationIds: string[];
    workerInterface: any;
    callback: (success: boolean) => void;
  }) {
    if (!jobs.isSubscribedToNotifications) {
      jobs.initializeNotificationSubscription();
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
    if (property.layer || property.layer === 0) {
      const layer = layers[property.layer];
      if (layer) {
        channel = layer.channel;
      }
    }
    this.propertiesAPI
      .computeProperty(property.name, main.dataset.id, {
        ...property,
        annotationIds: annotationIds.length ? annotationIds : undefined,
        channel,
        workerInterface: workerInterface
      })
      .then((response: any) => {
        // Keep track of running jobs
        const job = response.data[0];
        if (!job) {
          return;
        }
        if (job && job._id) {
          jobs.addJob({
            jobId: job._id,
            propertyId: property.id,
            annotationIds,
            datasetId: main.dataset!.id,
            callback: (success: boolean) => {
              this.fetchPropertyValues();
              filters.updateHistograms();
              callback(success);
            }
          } as IPropertyComputeJob);
        }
      });
  }

  @Mutation
  setProperties(properties: IAnnotationProperty[]) {
    this.properties = [...properties];
  }

  @Mutation
  setWorkerImageList(list: IWorkerImageList) {
    this.workerImageList = list;
  }

  @Action
  async fetchProperties() {
    const properties = await this.propertiesAPI.getProperties();
    if (properties && properties.length) {
      this.setProperties(properties);
    }
  }

  @Action
  async handleNewAnnotation({}: // newAnnotation,
  // newConnections
  {
    newAnnotation: IAnnotation;
    newConnections: IAnnotationConnection[];
  }) {
    // TODO: can't be done without the interface values
    // We also want to recompute properties for connected annotations
    // const relatedIds: string[] = [newAnnotation.id];
    // newConnections.forEach((connection: IAnnotationConnection) => {
    //   if (!relatedIds.includes(connection.childId)) {
    //     relatedIds.push(connection.childId);
    //   }
    //   if (!relatedIds.includes(connection.parentId)) {
    //     relatedIds.push(connection.parentId);
    //   }
    // });
    // // For all enabled and valid properties, send a compute request with these annotations
    // this.properties
    //   .filter((property: IAnnotationProperty) => property.enabled)
    //   .filter(
    //     (property: IAnnotationProperty) =>
    //       !property.shape || property.shape === newAnnotation.shape
    //   )
    //   .forEach((property: IAnnotationProperty) =>
    //     this.computeProperty({ property, annotationIds: relatedIds })
    //   );
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

  @Action
  async fetchWorkerImageList() {
    const list = await this.propertiesAPI.getWorkerImages();
    this.setWorkerImageList(list);
  }

  @Action
  async requestWorkerInterface(image: string) {
    this.propertiesAPI.requestWorkerInterface(image);
  }

  @Action
  async requestWorkerPreview({
    image,
    tool,
    workerInterface
  }: {
    image: string;
    tool: IToolConfiguration;
    workerInterface: { [id: string]: { type: string; value: any } };
  }) {
    if (!jobs.isSubscribedToNotifications) {
      jobs.initializeNotificationSubscription();
    }
    if (!main.dataset || !main.configuration) {
      return;
    }
    const datasetId = main.dataset.id;
    const { location, channel } = await annotation.context.dispatch(
      "getAnnotationLocationFromTool",
      tool
    );
    const tile = { XY: main.xy, Z: main.z, Time: main.time };
    this.propertiesAPI
      .requestWorkerPreview(image, tool, datasetId, workerInterface, {
        location,
        channel,
        tile
      })
      .then((response: any) => {
        // Keep track of running jobs
        const job = response.data[0];
        if (!job) {
          return;
        }
        if (job && job._id) {
          jobs.addJob({
            jobId: job._id,
            datasetId: main.dataset?.id || "",
            callback: (success: boolean) => {
              if (success) {
                this.fetchWorkerPreview(image);
              }
            }
          });
          setTimeout(() => {
            this.fetchWorkerPreview(image);
          }, 5000);
        }
      });
  }
}

export default getModule(Properties);
