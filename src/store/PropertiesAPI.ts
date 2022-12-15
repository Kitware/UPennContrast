import { RestClientInstance } from "@/girder";
import {
  IAnnotationProperty,
  IWorkerInterface,
  IToolConfiguration,
  IWorkerImageList,
  IAnnotationPropertyConfiguration
} from "./model";

export default class AnnotationsAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  histogramsLoaded = 0;

  async createProperty(
    property: IAnnotationPropertyConfiguration
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
    const { name, image, shape, tags } = item;
    return {
      id: name,
      name,
      image,
      tags,
      shape,
      computed: false
    };
  }

  async getWorkerImages(): Promise<IWorkerImageList> {
    return this.client.get("worker_interface/available").then(res => {
      return res.data;
    });
  }

  async requestWorkerInterface(image: string) {
    this.client.post(
      `worker_interface/request?image=${encodeURIComponent(image)}`
    );
  }

  async getWorkerInterface(image: string): Promise<IWorkerInterface> {
    return this.client
      .get(`worker_interface?image=${encodeURIComponent(image)}`)
      .then(res => {
        return res.data.interface || {};
      });
  }

  async requestWorkerPreview(
    image: string,
    tool: IToolConfiguration,
    datasetId: string,
    workerInterface: { [id: string]: { type: string; value: any } },
    metadata: {
      channel: Number;
      location: { XY: Number; Z: Number; Time: Number };
      tile: { XY: Number; Z: Number; Time: Number };
    }
  ) {
    const { configurationId, description, id, name, type, values } = tool;
    const { annotation, connectTo } = values;
    const params = {
      configurationId,
      datasetId,
      description,
      type,
      id,
      name,
      image,
      channel: metadata.channel,
      assignment: metadata.location,
      tags: annotation.tags,
      tile: metadata.tile,
      connectTo,
      workerInterface
    };
    return this.client.post(
      `worker_preview/request?datasetId=${datasetId}&image=${encodeURIComponent(
        image
      )}`,
      params
    );
  }

  async getWorkerPreview(
    image: string
  ): Promise<{ text: string; image: string }> {
    return this.client
      .get(`worker_preview?image=${encodeURIComponent(image)}`)
      .then(res => {
        return res.data.preview || {};
      });
  }

  async clearWorkerPreview(image: string) {
    this.client.delete(`/worker_preview?image=${encodeURIComponent(image)}`);
  }
}
