import {
  getModule,
  Action,
  Module,
  VuexModule,
  Mutation
} from "vuex-module-decorators";
import store from "./root";
import main from "./index";
import { IGirderFolder, IGirderItem, IGirderSelectAble } from "@/girder";
import Vue from "vue";
import { IDataset, IDatasetConfiguration } from "./model";
import { asConfigurationItem, asDataset, parseTiles } from "./GirderAPI";

/**
 * Store to cache requests to resources, mostly items and folder
 */
@Module({ dynamic: true, store, name: "girderResources" })
export class GirderResources extends VuexModule {
  resources: { [resourceId: string]: IGirderSelectAble | null } = {};

  @Mutation
  public setResource({
    id,
    resource
  }: {
    id: string;
    resource: IGirderSelectAble | null;
  }) {
    Vue.set(this.resources, id, resource);
  }

  @Action
  private requestResource({
    id,
    type
  }: {
    id: string;
    type: IGirderSelectAble["_modelType"];
  }) {
    return main.api.getResource(id, type);
  }

  @Action
  public async getResource({
    id,
    type
  }: {
    id: string;
    type: IGirderSelectAble["_modelType"];
  }) {
    if (!(id in this.resources)) {
      try {
        const resource = await this.requestResource({ id, type });
        this.setResource({ id, resource });
      } catch (e) {
        this.setResource({ id, resource: null });
      }
    }
    const resource = this.resources[id];
    // This check ensures that get{Type} returns a resource of the right type (e.g. getFolder)
    return resource?._modelType === type ? resource : null;
  }

  @Action
  public async getFolder(id: string): Promise<IGirderFolder | null> {
    const resource = await this.getResource({ id, type: "folder" });
    return resource as IGirderFolder | null;
  }

  @Action
  public async getItem(id: string): Promise<IGirderItem | null> {
    const resource = await this.getResource({ id, type: "item" });
    return resource as IGirderItem | null;
  }

  get watchResource() {
    return (id: string, type: IGirderSelectAble["_modelType"]) => {
      if (!(id in this.resources)) {
        return undefined;
      }
      const resource = this.resources[id];
      return resource?._modelType === type ? resource : null;
    };
  }

  get watchFolder() {
    return (id: string) =>
      this.watchResource(id, "folder") as IGirderFolder | null | undefined;
  }

  get watchItem() {
    return (id: string) =>
      this.watchResource(id, "item") as IGirderItem | null | undefined;
  }

  @Mutation
  private resetResource(id: string) {
    Vue.delete(this.resources, id);
  }

  @Action
  public async forceFetchResource({
    id,
    type
  }: {
    id: string;
    type: IGirderSelectAble["_modelType"];
  }) {
    this.resetResource(id);
    return await this.getResource({ id, type });
  }

  @Action
  public ressourceChanged(id: string) {
    this.resetResource(id);
  }

  @Action
  public ressourceDeleted(id: string) {
    this.setResource({ id, resource: null });
  }

  @Action
  async getConfiguration(id: string): Promise<IDatasetConfiguration | null> {
    const item = await this.getItem(id);
    return item ? asConfigurationItem(item) : null;
  }

  @Action
  async getDataset({
    id,
    unrollXY,
    unrollZ,
    unrollT
  }: {
    id: string;
    unrollXY: boolean;
    unrollZ: boolean;
    unrollT: boolean;
  }): Promise<IDataset | null> {
    const [folder, items] = await Promise.all([
      this.getFolder(id),
      main.api.getItems(id)
    ]);
    if (!folder) {
      return null;
    }
    const baseDataset = asDataset(folder);
    // Just use the first image if it exists
    const imageItem = items!.find(d => d.largeImage);
    if (imageItem === undefined) {
      return baseDataset;
    }
    const tiles = await main.api.getTiles(imageItem);
    return {
      ...baseDataset,
      ...parseTiles(imageItem, tiles, unrollXY, unrollZ, unrollT)
    };
  }
}

export default getModule(GirderResources);
