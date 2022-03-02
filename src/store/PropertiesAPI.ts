import { RestClientInstance } from "@/girder";
import { IAnnotationProperty } from "./model";

import { Promise } from "bluebird";

export default class AnnotationsAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  histogramsLoaded = 0;

  async createProperty(
    property: IAnnotationProperty
  ): Promise<IAnnotationProperty> {
    return this.client.post("annotation_property", property).then(res => {
      return this.toProperty(res.data);
    });
  }

  async getProperties(): Promise<IAnnotationProperty[]> {
    return this.client.get("annotation_property?limit=1000").then(res => {
      return res.data.map(this.toProperty);
    });
  }

  async getPropertyHistogram(
    datasetId: string,
    propertyId: string,
    buckets: number = 255
  ) {
    return this.client
      .get(
        `annotation_property_values/histogram?datasetId=${datasetId}&propertyId=${propertyId}&buckets=${buckets}`
      )
      .then(res => res.data);
  }

  async computeProperty(propertyId: string, datasetId: string, params: any) {
    return this.client.post(
      `annotation_property/${propertyId}/compute?datasetId=${datasetId}`,
      params
    );
  }

  async getPropertyValues(datasetId: string) {
    return this.client
      .get(`annotation_property_values?datasetId=${datasetId}&limit=1000`)
      .then(res => {
        // map values by annotation id
        const annotationMapping: {
          [annotationId: string]: { [propertyId: string]: number };
        } = {};
        res.data.forEach(
          (value: {
            annotationId: string;
            values: { [propertyId: string]: number };
          }) => {
            annotationMapping[value.annotationId] = {
              ...annotationMapping[value.annotationId],
              ...value.values
            };
          }
        );
        return annotationMapping;
      });
  }

  subscribeToNotifications(): EventSource | null {
    return new EventSource(
      `${this.client.apiRoot}/notification/stream?token=${this.client.token}`
    );
  }

  toProperty(item: any): IAnnotationProperty {
    const { _id, name, image, propertyType, layer, shape, tags } = item;
    return {
      id: name,
      name,
      image,
      propertyType,
      layer,
      tags,
      independant: false,
      shape,
      enabled: false,
      computed: false,
      customName: null
    };
  }
}
