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
  IAnnotationProperty
} from "./model";

import Vue from "vue";

import main from "./index";

// TODO: mutations for properties
// TODO: this means we probably need to regroup them all under one array
@Module({ dynamic: true, store, name: "properties" })
export class Properties extends VuexModule {
  propertiesAPI = main.propertiesAPI;

  properties: IAnnotationProperty[] = [];

  annotationListIds: string[] = [];

  propertyValues: {
    [annotationId: string]: { [propertyId: string]: number };
  } = {};

  @Mutation
  updatePropertyValues(values: {
    [annotationId: string]: { [propertyId: string]: number };
  }) {
    // TODO: merge instead
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
      this.computeProperty(newProp);
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
  async computeProperty(property: IAnnotationProperty) {
    if (!property.enabled || !main.dataset?.id) {
      return;
    }
    this.propertiesAPI.computeProperty(property.name, main.dataset.id, {
      ...property
    });
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
  async handleNewAnnotation() // newAnnotation: IAnnotation,
  // newConnections: IAnnotationConnection[],
  // image: any
  {
    // TODO:
    // For all enabled and valid properties
    // Send a compute request for only this annotation ?
    // Or do this in the backend with annotation creation hooks ?
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
  async createProperty({
    name,
    image,
    type
  }: {
    name: string;
    image: string;
    type: "layer" | "morphology" | "relational";
  }) {
    const newProperty = await this.propertiesAPI.createProperty(
      name,
      image,
      type
    );
    if (newProperty) {
      this.setProperties([...this.properties, newProperty]);
    }
  }
}

export default getModule(Properties);
