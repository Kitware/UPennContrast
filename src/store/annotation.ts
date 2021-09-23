import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import main from "./index";
import sync from "./sync";

import {
  IAnnotation,
  IAnnotationConnection,
  IAnnotationFilter,
  ITagAnnotationFilter,
  IPropertyAnnotationFilter,
  IROIAnnotationFilter
} from "./model";

@Module({ dynamic: true, store, name: "annotation" })
export class Annotations extends VuexModule {
  // Annotations from the current dataset and configuration
  annotations: IAnnotation[] = [];
  // Connections from the current dataset and configuration
  annotationConnections: IAnnotationConnection[] = [];

  @Mutation
  public addAnnotation(value: IAnnotation) {
    this.annotations = [...this.annotations, value];
  }

  @Mutation
  public setAnnotations(values: IAnnotation[]) {
    this.annotations = values;
  }

  @Mutation
  public addConnection(value: IAnnotationConnection) {
    this.annotationConnections = [...this.annotationConnections, value];
  }

  @Mutation
  public setConnections(values: IAnnotationConnection[]) {
    this.annotationConnections = values;
  }

  @Action
  // Very inefficient, but will work for now
  async syncAnnotations() {
    if (!main.dataset) {
      return;
    }
    sync.setSaving(true);
    if (!main.configuration) {
      return;
    }
    try {
      await main.api.setAnnotationsToConfiguration(
        this.annotations,
        this.annotationConnections,
        main.configuration
      );
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Action
  async fetchAnnotations() {
    this.setAnnotations([]);
    this.setConnections([]);
    if (!main.dataset || !main.configuration) {
      return;
    }
    try {
      const results = await main.api.getAnnotationsForConfiguration(
        main.configuration
      );
      if (results) {
        this.setAnnotations(results.annotations);
        this.setConnections(results.annotationConnections);
      }
    } catch (error) {
      error(error.message);
    }
  }
}

export default getModule(Annotations);
