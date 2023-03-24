import { RestClientInstance } from "@/girder";
import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationBase,
  AnnotationShape,
  IGeoJSPoint,
  IToolConfiguration,
  IAnnotationConnectionBase,
  IWorkerInterfaceValues,
  IAnnotationLocation
} from "./model";

import { logError } from "@/utils/log";
import { fetchAllPages } from "@/utils/fetch";

export default class AnnotationsAPI {
  private readonly client: RestClientInstance;

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  histogramsLoaded = 0;

  createAnnotation(
    annotationBase: IAnnotationBase
  ): Promise<IAnnotation | null> {
    return this.client
      .post("upenn_annotation", annotationBase)
      .then(r => this.toAnnotation(r.data))
      .catch(err => {
        logError(`Unable to send new annotation to server ${err}`);
        return null;
      });
  }

  createMultipleAnnotations(
    annotationList: IAnnotationBase[]
  ): Promise<IAnnotation[] | null> {
    return this.client
      .post("upenn_annotation/multiple", annotationList)
      .then(response => {
        const annotations: IAnnotation[] = [];
        for (const item of response.data) {
          annotations.push(this.toAnnotation(item));
        }
        return annotations;
      })
      .catch(err => {
        logError(`Unable to send multiple new annotations to server ${err}`);
        return null;
      });
  }

  createConnections(
    annotationsIds: string[],
    tags: string[],
    channelId: number | null
  ): Promise<IAnnotationConnection[] | null> {
    return this.client
      .post("annotation_connection/connectTo", {
        annotationsIds,
        tags,
        channelId
      })
      .then(res => {
        return res.data.map((connection: any) => this.toConnection(connection));
      });
  }

  async getAnnotationsForDatasetId(id: string): Promise<IAnnotation[]> {
    const annotations: IAnnotation[] = [];
    const pages = await fetchAllPages(
      this.client,
      "upenn_annotation",
      id,
      100000
    );
    for (const page of pages) {
      const newAnnotations = page.map(this.toAnnotation);
      annotations.push(...newAnnotations);
    }
    return annotations;
  }

  async deleteAnnotation(id: string): Promise<void> {
    return this.client.delete(`upenn_annotation/${id}`);
  }

  async deleteMultipleAnnotations(annotationIds: string[]) {
    return this.client.delete("upenn_annotation/multiple", {
      data: annotationIds
    });
  }

  updateAnnotation(annotation: IAnnotation) {
    const newAnnotation: Partial<IAnnotation> = { ...annotation };
    delete newAnnotation.id;
    return this.client.put(`upenn_annotation/${annotation.id}`, newAnnotation);
  }

  toAnnotation = (item: any): IAnnotation => {
    const {
      name,
      tags,
      shape,
      channel,
      location,
      coordinates,
      _id,
      datasetId
    } = item;
    return {
      name,
      tags,
      shape,
      channel,
      location,
      coordinates,
      id: _id,
      datasetId
    };
  };

  createConnection(
    annotationConnectionBase: IAnnotationConnectionBase
  ): Promise<IAnnotationConnection | null> {
    return this.client
      .post("annotation_connection", annotationConnectionBase)
      .then(r => this.toConnection(r.data))
      .catch(err => {
        logError(`Unable to send new annotation connection to server ${err}`);
        return null;
      });
  }

  createMultipleConnections(
    annotationConnectionBases: IAnnotationConnectionBase[]
  ): Promise<IAnnotationConnection[] | null> {
    return this.client
      .post("annotation_connection/multiple", annotationConnectionBases)
      .then(response => {
        const connections: IAnnotationConnection[] = [];
        for (const item of response.data) {
          connections.push(this.toConnection(item));
        }
        return connections;
      })
      .catch(err => {
        logError(
          `Unable to send multiple new annotation connections to server ${err}`
        );
        return null;
      });
  }

  async getConnectionsForDatasetId(
    id: string
  ): Promise<IAnnotationConnection[]> {
    const connections: IAnnotationConnection[] = [];
    const pages = await fetchAllPages(
      this.client,
      "annotation_connection",
      id,
      100000
    );
    for (const page of pages) {
      const newConnections = page.map(this.toConnection);
      connections.push(...newConnections);
    }
    return connections;
  }

  async deleteConnection(id: string): Promise<void> {
    return this.client.delete(`annotation_connection/${id}`);
  }

  async updateConnection(connection: IAnnotationConnection) {
    const newConnection: Partial<IAnnotationConnection> = { ...connection };
    delete newConnection.id;
    this.client.put(`annotation_connection/${connection.id}`, newConnection);
  }

  async computeAnnotationWithWorker(
    tool: IToolConfiguration,
    datasetId: string,
    metadata: {
      channel: Number;
      location: IAnnotationLocation;
      tile: IAnnotationLocation;
    },
    workerInterface: IWorkerInterfaceValues
  ) {
    const { configurationId, description, id, name, type, values } = tool;
    const image = values.image.image;
    const { annotation, connectTo, jobDateTag } = values;
    let tags = annotation.tags;
    if (jobDateTag) {
      const date = new Date(Date.now());
      const timeZone = date.getTimezoneOffset() / 60;
      const dateString =
        [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-") +
        " " +
        [date.getHours(), date.getMinutes(), date.getSeconds()].join(":") +
        " UTC" +
        (timeZone >= 0 ? "+" : "") +
        timeZone;
      const computedTag = image + " job " + dateString;
      tags = [...tags, computedTag];
    }
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
      tags,
      tile: metadata.tile,
      connectTo,
      workerInterface
    };
    return this.client.post(
      `upenn_annotation/compute?datasetId=${datasetId}`,
      params
    );
  }

  toConnection = (item: any): IAnnotationConnection => {
    const { label, tags, _id, parentId, childId, datasetId } = item;
    return {
      label,
      tags,
      id: _id,
      parentId,
      childId,
      datasetId
    };
  };
}
