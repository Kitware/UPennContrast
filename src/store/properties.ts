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
  IWorkerInterfaceValues,
  IComputeJob
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
    // First, requestWorkerInterface: girder asks the worker for its interface
    await this.requestWorkerInterface(image);
    // Then, getWorkerInterface: client asks girder for the interface it should have received
    const workerInterface = await this.propertiesAPI.getWorkerInterface(image);
    // Associate the worker interface with the image
    this.setWorkerInterface({ image, workerInterface });
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
  async computeProperty({
    property,
    callback = () => {}
  }: {
    property: IAnnotationProperty;
    callback: (success: boolean) => void;
  }) {
    if (!main.dataset) {
      return null;
    }
    const datasetId = main.dataset.id;

    const response = await this.propertiesAPI.computeProperty(
      property.id,
      datasetId,
      property
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
        this.fetchPropertyValues();
        filters.updateHistograms();
        callback(success);
      }
    };
    jobs.addJob(computeJob);
    return computeJob;
  }

  @Mutation
  protected setPropertiesImpl(properties: IAnnotationProperty[]) {
    this.properties = [...properties];
  }

  @Action
  protected setProperties(properties: IAnnotationProperty[]) {
    this.setPropertiesImpl(properties);
    const propertyIds = this.properties.map(p => p.id);
    this.context.dispatch("updateConfigurationProperties", propertyIds);
  }

  @Mutation
  setWorkerImageList(list: IWorkerImageList) {
    this.workerImageList = list;
  }

  @Action
  // Fetch properties corresponding of the configuration
  // This action should be called when changing configuration
  async fetchProperties() {
    if (main.configuration) {
      const properties = await this.propertiesAPI.getProperties(
        main.configuration.propertyIds
      );
      this.setPropertiesImpl(properties);
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
    // TODO: temp another configuration could be using this property!
    // await this.propertiesAPI.deleteProperty(propertyId);
    this.setProperties(this.properties.filter(p => p.id !== propertyId));
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
      .requestWorkerPreview(
        image,
        tool,
        datasetId,
        workerInterface,
        {
          location,
          channel,
          tile
        },
        main.layers
      )
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
