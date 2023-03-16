import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import {
  IAnnotationProperty,
  IWorkerInterface,
  IToolConfiguration,
  IAnnotationPropertyValues,
  IWorkerImageList,
  IAnnotationPropertyConfiguration,
  IAnnotation,
  IWorkerInterfaceValues
} from "./model";

import Vue from "vue";

import main from "./index";

import { canComputeAnnotationProperty } from "@/utils/annotation";
import filters from "./filters";
import annotations from "./annotation";
import jobs from "./jobs";

@Module({ dynamic: true, store, name: "properties" })
export class Properties extends VuexModule {
  propertiesAPI = main.propertiesAPI;

  properties: IAnnotationProperty[] = [];

  annotationListIds: string[] = [];

  propertyValues: IAnnotationPropertyValues = {};

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
    // This function fetches the interface
    const fetchInterface = () => {
      this.propertiesAPI.getWorkerInterface(image).then(workerInterface => {
        this.setWorkerInterface({ image, workerInterface });
      });
    };

    // First, requestWorkerInterface (girder will ask the worker to send it the interface)
    // Then, getWorkerInterface (girder will send the interface it has received)
    // If we don't call requestWorkerInterface first, girder will have no interface to send
    const requestPromise = this.requestWorkerInterface(image);
    let isPromisePending = true;
    // Fetch interface when requestWorkerInterface resolves
    requestPromise.finally(() => {
      fetchInterface();
      isPromisePending = false;
    });
    // Also fetch after 5s if it is still pending
    setTimeout(() => {
      if (isPromisePending) {
        fetchInterface();
      }
    }, 5000);
  }

  @Mutation
  updatePropertyValues(values: IAnnotationPropertyValues) {
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

  get uncomputedAnnotationsPerProperty() {
    const uncomputed: { [propertyId: string]: IAnnotation[] } = {};
    for (const property of this.properties) {
      uncomputed[property.id] = [];
    }
    for (const annotation of annotations.annotations) {
      for (const property of this.properties) {
        if (
          this.propertyValues[annotation.id]?.[property.id] === undefined &&
          canComputeAnnotationProperty(property, annotation)
        ) {
          uncomputed[property.id].push(annotation);
        }
      }
    }
    return uncomputed;
  }

  @Action
  computeProperty({
    property,
    callback = () => {}
  }: {
    property: IAnnotationProperty;
    callback: (success: boolean) => void;
  }) {
    if (!main.dataset?.id || !main.configuration?.view?.layers) {
      return;
    }

    this.propertiesAPI
      .computeProperty(property.id, main.dataset.id, property)
      .then((response: any) => {
        // Keep track of running jobs
        const job = response.data[0];
        if (!job) {
          return;
        }
        if (job && job._id) {
          jobs.addJob({
            jobId: job._id,
            datasetId: main.dataset!.id,
            callback: (success: boolean) => {
              this.fetchPropertyValues();
              filters.updateHistograms();
              callback(success);
            }
          });
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
    if (properties) {
      this.setProperties(properties);
    }
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
  async createProperty(property: IAnnotationPropertyConfiguration) {
    const newProperty = await this.propertiesAPI.createProperty(property);
    if (newProperty) {
      this.setProperties([...this.properties, newProperty]);
    }
    return newProperty;
  }

  @Action
  async deleteProperty(propertyId: string) {
    await this.propertiesAPI.deleteProperty(propertyId);
    await this.fetchProperties();
  }

  @Action
  async deletePropertyValues(propertyId: string) {
    if (!main.dataset?.id) {
      return;
    }
    await this.propertiesAPI.deletePropertyValues(propertyId, main.dataset.id);
    await this.fetchPropertyValues();
  }

  @Action
  async fetchWorkerImageList() {
    const list = await this.propertiesAPI.getWorkerImages();
    this.setWorkerImageList(list);
  }

  @Action
  async requestWorkerInterface(image: string) {
    const response = await this.propertiesAPI.requestWorkerInterface(image);
    const jobId = response.data[0]?._id;
    if (!jobId) {
      return;
    }
    return new Promise(resolve => {
      jobs.addJob({
        jobId: jobId,
        datasetId: main.dataset?.id || null,
        callback: resolve
      });
    });
  }

  @Action
  async requestWorkerPreview({
    image,
    tool,
    workerInterface
  }: {
    image: string;
    tool: IToolConfiguration;
    workerInterface: IWorkerInterfaceValues;
  }) {
    if (!main.dataset || !main.configuration) {
      return;
    }
    const datasetId = main.dataset.id;
    const { location, channel } = await annotations.context.dispatch(
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
