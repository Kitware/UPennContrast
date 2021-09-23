import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import sync from "./sync";
import annotation from "./annotation";

import {
  IAnnotation,
  IAnnotationConnection,
  IMorphologicAnnotationProperty,
  IAnnotationProperty,
  IRelationalAnnotationProperty,
  ILayerDependentAnnotationProperty,
  IAnnotationPropertyComputeParameters,
  ITagAnnotationFilter
} from "./model";
import { values } from "lodash-es";
import { logWarning } from "@/utils/log";

// TODO: mutations for properties
// TODO: this means we probably need to regroup them all under one array
@Module({ dynamic: true, store, name: "properties" })
export class Properties extends VuexModule {
  computedValues: {
    [propertyId: string]: { annotationIds: string[]; values: number[] };
  } = {};
  morphologicProperties: IMorphologicAnnotationProperty[] = [
    {
      id: "length",
      name: "Length",

      enabled: false,
      computed: false,

      requiredShape: "line"
    },
    {
      id: "perimeter",
      name: "Perimeter",

      enabled: false,
      computed: false,
      requiredShape: "polygon"
    }
  ];

  relationalProperties: IRelationalAnnotationProperty[] = [
    {
      id: "numberOfConnected",
      name: "Number Of Connected",

      enabled: false,
      computed: false,

      independant: true,

      filter: {
        id: "numberOfConnectedFilter",
        tags: [],
        shape: "polygon",
        exclusive: true,
        enabled: true
      }
    },
    {
      id: "distanceToNearest",
      name: "Distance To Nearest",

      enabled: false,
      computed: false,

      independant: false,

      filter: {
        id: "distanceToNearestFilter",
        tags: [],
        shape: "polygon",
        exclusive: true,
        enabled: true
      }
    }
  ];

  layerDependantProperties: ILayerDependentAnnotationProperty[] = [
    {
      id: "averageIntensity",
      name: "Average Intensity",

      enabled: false,
      computed: false,

      layer: 0
    }
  ];

  annotationListIds: string[] = [];

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

  get properties(): IAnnotationProperty[] {
    return [
      ...this.morphologicProperties,
      ...this.relationalProperties,
      ...this.layerDependantProperties
    ];
  }

  @Mutation
  replaceProperty(property: IAnnotationProperty) {
    // TODO: ideally conserve index so the list doesn't shuffle around
    // TODO: or sort alphabetically
    const find = (prop: IAnnotationProperty) => prop.id === property.id;
    const filter = (prop: IAnnotationProperty) => prop.id !== property.id;
    if (this.morphologicProperties.find(find)) {
      this.morphologicProperties = [
        ...this.morphologicProperties.filter(filter),
        property as IMorphologicAnnotationProperty
      ];
    } else if (this.relationalProperties.find(find)) {
      this.relationalProperties = [
        ...this.relationalProperties.filter(filter),
        property as IRelationalAnnotationProperty
      ];
    } else if (this.layerDependantProperties) {
      this.layerDependantProperties = [
        ...this.layerDependantProperties.filter(filter),
        property as ILayerDependentAnnotationProperty
      ];
    }
  }

  get getPropertyById() {
    return (id: string) => {
      const find = (prop: IAnnotationProperty) => prop.id === id;
      const morph = this.morphologicProperties.find(find);
      if (morph) {
        return morph as IAnnotationProperty;
      }
      const relational = this.relationalProperties.find(find);
      if (relational) {
        return relational as IAnnotationProperty;
      }
      const layer = this.layerDependantProperties.find(find);
      if (layer) {
        return layer as IAnnotationProperty;
      }
      return null;
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

  get eligibleAnnotationsForPropertyId() {
    return (id: string) => {
      const morph = this.morphologicProperties.find(
        (property: IMorphologicAnnotationProperty) => property.id === id
      );
      if (morph && morph.requiredShape) {
        return annotation.annotations.filter(
          (annotation: IAnnotation) => annotation.shape === morph.requiredShape
        );
      }
      return annotation.annotations;
    };
  }

  @Action
  async computeProperty(property: IAnnotationProperty) {
    if (!property.enabled) {
      return;
    }
    this.replaceProperty({ ...property, computed: false });
  }

  @Action
  async handleNewAnnotation(
    newAnnotation: IAnnotation,
    newConnections: IAnnotationConnection[],
    image: any
  ) {}
}

export default getModule(Properties);
