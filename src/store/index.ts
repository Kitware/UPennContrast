import { RestClient, RestClientInstance, IGirderItem } from "@/girder";
import { IGirderSelectAble, IGirderUser } from "@/girder";
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import AnnotationsAPI from "./AnnotationsAPI";
import PropertiesAPI from "./PropertiesAPI";

import GirderAPI from "./GirderAPI";
import { getLayerImages, getLayerSliceIndexes } from "./images";
import {
  IDataset,
  IDatasetConfiguration,
  IDatasetConfigurationMeta,
  IDisplayLayer,
  IImage,
  newLayer,
  AnnotationSelectionTypes,
  ILayerStackImage,
  IDisplaySlice,
  TLayerMode,
  ISnapshot,
  IDatasetConfigurationBase,
  IToolConfiguration,
  AnnotationNames,
  AnnotationShape,
  IDatasetView,
  IContrast
} from "./model";

import persister from "./Persister";
import store from "./root";
import sync from "./sync";
import { MAX_NUMBER_OF_RECENT_DATASET_VIEWS } from "./constants";
import Vue from "vue";
export { default as store } from "./root";

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  girderUrl = persister.get(
    "girderUrl",
    process.env.VUE_APP_GIRDER_URL || "http://localhost:8080"
  );
  girderRest = new RestClient({
    apiRoot: `${this.girderUrl}/api/v1`
  });
  api = new GirderAPI(this.girderRest);
  annotationsAPI = new AnnotationsAPI(this.girderRest);
  propertiesAPI = new PropertiesAPI(this.girderRest);

  girderUser: IGirderUser | null = this.girderRest.user;

  selectedDatasetId: string | null = null;
  dataset: IDataset | null = null;

  selectedConfigurationId: string | null = null;
  configuration: IDatasetConfiguration | null = null;
  recentDatasetViews: IDatasetView[] = [];

  datasetView: IDatasetView | null = null;

  xy: number = 0;
  z: number = 0;
  time: number = 0;
  layerMode: TLayerMode = "multiple";

  drawAnnotations: boolean = true;
  filteredDraw: boolean = false;
  annotationSelectionType: AnnotationSelectionTypes =
    AnnotationSelectionTypes.TOGGLE;

  showTooltips: boolean = false;
  filteredAnnotationTooltips: boolean = false;

  valueOnHover: boolean = true;
  hoverValue: { [layerId: string]: number[] } | null = null;

  restrictAnnotationsToFilters: boolean = true;
  restrictAnnotationsToActive: boolean = true;
  drawAnnotationConnections: boolean = true;

  unrollXY: boolean = false;
  unrollZ: boolean = false;
  unrollT: boolean = false;
  snapshot?: string;

  isAnnotationPanelOpen: boolean = false;
  annotationPanelBadge: boolean = false;

  toolTemplateList: any[] = [];
  selectedTool: IToolConfiguration | null = null;
  readonly availableToolShapes: { value: string; text: string }[] = [
    {
      text: AnnotationNames[AnnotationShape.Point],
      value: AnnotationShape.Point
    },
    {
      text: AnnotationNames[AnnotationShape.Polygon],
      value: AnnotationShape.Polygon
    },
    {
      text: AnnotationNames[AnnotationShape.Line],
      value: AnnotationShape.Line
    }
  ];

  get tools() {
    return this.configuration?.tools || [];
  }

  get layers(): IDisplayLayer[] {
    const configurationLayers = this.configuration?.layers || [];
    // Use contrast from dataset view
    return configurationLayers.map(layer => {
      const contrast = this.datasetView?.layerContrasts[layer.id];
      return contrast ? { ...layer, contrast } : { ...layer };
    });
  }

  get unroll() {
    return this.unrollXY || this.unrollZ || this.unrollT;
  }

  get userName() {
    return this.girderUser ? this.girderUser.login : "anonymous";
  }

  get isLoggedIn() {
    return this.girderUser != null;
  }

  get layerSliceIndexes() {
    return (layer: IDisplayLayer) => {
      if (!this.dataset) {
        return null;
      }
      return getLayerSliceIndexes(
        layer,
        this.dataset,
        this.time,
        this.xy,
        this.z
      );
    };
  }

  @Mutation
  public setDrawAnnotations(value: boolean) {
    this.drawAnnotations = value;
  }

  @Mutation
  public setShowTooltips(value: boolean) {
    this.showTooltips = value;
  }

  @Mutation
  public setFilteredAnnotationTooltips(value: boolean) {
    this.filteredAnnotationTooltips = value;
  }

  @Mutation
  public setValueOnHover(value: boolean) {
    this.valueOnHover = value;
  }

  @Mutation
  public setHoverValue(value: { [layerId: string]: number[] } | null) {
    this.hoverValue = value;
  }

  @Mutation
  public setAnnotationSelectionType(value: AnnotationSelectionTypes) {
    this.annotationSelectionType = value;
  }

  @Mutation
  public setFilteredDraw(value: boolean) {
    this.filteredDraw = value;
  }

  @Mutation
  public setDrawAnnotationConnections(value: boolean) {
    this.drawAnnotationConnections = value;
  }

  @Mutation
  setToolTemplateList(value: any[]) {
    this.toolTemplateList = value;
  }

  @Mutation
  private setSelectedToolImpl(tool: IToolConfiguration | null) {
    this.selectedTool = tool;
  }

  @Action
  setSelectedToolId(id: string | null) {
    let tool: IToolConfiguration | null = null;
    if (id) {
      tool = this.tools.find(t => t.id === id) || null;
    }
    this.setSelectedToolImpl(tool);
  }

  @Mutation
  private setConfigurationTools(tools: IToolConfiguration[]) {
    if (this.configuration) {
      this.configuration.tools = tools;
    }
  }

  @Action
  addToolToConfiguration(tool: IToolConfiguration) {
    if (this.configuration) {
      this.setConfigurationTools([...this.configuration.tools, tool]);
      // Fetch the worker interface for this new tool if there is one
      const image = tool.values?.image?.image;
      if (image) {
        this.context.dispatch("requestWorkerInterface", image);
      }
      this.syncConfiguration("tools");
    }
  }

  @Action
  removeToolFromConfiguration(toolId: string) {
    if (this.selectedTool?.id === toolId) {
      this.setSelectedToolId(null);
    }
    if (this.configuration) {
      this.configuration.tools = this.tools.filter(t => t.id !== toolId);
      this.syncConfiguration("tools");
    }
  }

  @Action
  editToolInConfiguration(tool: IToolConfiguration) {
    const configurationTools = this.configuration?.tools;
    if (!configurationTools) {
      return;
    }
    const toolIdx = configurationTools.findIndex(({ id }) => id === tool.id);
    if (toolIdx < 0) {
      return;
    }
    Vue.set(configurationTools, toolIdx, tool);
    if (this.selectedTool?.id === tool.id) {
      this.setSelectedToolImpl(tool);
    }
    this.syncConfiguration("tools");
  }

  @Action
  protected async loggedIn({
    girderUrl,
    girderRest
  }: {
    girderUrl: string;
    girderRest: RestClientInstance;
  }) {
    await this.loggedInImpl({ girderRest, girderUrl });
    this.setSelectedConfiguration(this.selectedConfigurationId);
    this.setSelectedDataset(this.selectedDatasetId);
  }

  @Mutation
  protected loggedInImpl({
    girderUrl,
    girderRest
  }: {
    girderUrl: string;
    girderRest: RestClientInstance;
  }) {
    this.girderUrl = persister.set("girderUrl", girderUrl);
    this.girderRest = girderRest;
    this.girderUser = girderRest.user;
    // don't replace the api hook with a new one.
    /*
    this.api = new GirderAPI(this.girderRest);
    this.annotationsAPI = new AnnotationsAPI(this.girderRest);
    this.propertiesAPI = new PropertiesAPI(this.girderRest);
    */
  }

  @Mutation
  protected loggedOut() {
    this.girderUser = null;
    this.selectedDatasetId = null;
    this.dataset = null;
    this.selectedConfigurationId = null;
    this.configuration = null;
  }

  @Mutation
  protected setDataset({
    id,
    data
  }: {
    id: string | null;
    data: IDataset | null;
  }) {
    if (this.selectedDatasetId === id && this.dataset?.id === data?.id) {
      return;
    }
    this.selectedDatasetId = id;
    this.dataset = data;
  }

  @Action
  protected setConfiguration({
    id,
    data
  }: {
    id: string | null;
    data: IDatasetConfiguration | null;
  }) {
    this.setConfigurationImpl({ id, data });
    this.context.dispatch("fetchProperties");
  }

  @Mutation
  protected setConfigurationImpl({
    id,
    data
  }: {
    id: string | null;
    data: IDatasetConfiguration | null;
  }) {
    this.selectedConfigurationId = id;
    this.configuration = data;
    if (!data) {
      return;
    }
  }

  @Mutation
  private setXYImpl(value: number) {
    this.xy = value;
  }

  @Mutation
  private setZImpl(value: number) {
    this.z = value;
  }

  @Mutation
  private setTimeImpl(value: number) {
    this.time = value;
  }

  @Mutation
  public setUnrollXYImpl(value: boolean) {
    this.unrollXY = value;
  }

  @Mutation
  public setUnrollZImpl(value: boolean) {
    this.unrollZ = value;
  }

  @Mutation
  public setUnrollTImpl(value: boolean) {
    this.unrollT = value;
  }

  @Mutation
  public setAnnotationPanelBadge(value: boolean) {
    this.annotationPanelBadge = value;
  }

  @Mutation
  public setIsAnnotationPanelOpen(value: boolean) {
    this.isAnnotationPanelOpen = value;
  }

  @Action
  async logout() {
    sync.setSaving(true);
    try {
      await this.girderRest.logout();
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error);
    }
    this.loggedOut();
  }

  @Mutation
  private setRecentDatasetViewsImpl(recentDatasetViews: IDatasetView[]) {
    this.recentDatasetViews = recentDatasetViews;
  }

  @Action
  async fetchRecentDatasetViews() {
    const recentDatasetViews = await this.api.getRecentDatasetViews(
      MAX_NUMBER_OF_RECENT_DATASET_VIEWS
    );
    this.setRecentDatasetViewsImpl(recentDatasetViews);
  }

  @Action
  async initialize() {
    if (!this.girderRest.token) {
      return;
    }
    try {
      sync.setLoading(true);
      const user = await this.girderRest.fetchUser();
      if (user) {
        await this.loggedIn({
          girderUrl: this.girderUrl,
          girderRest: this.girderRest
        });
      }
      await this.initFromUrl();
      sync.setLoading(false);
      await this.fetchRecentDatasetViews();
    } catch (error) {
      sync.setLoading(error);
    }
  }

  @Action
  private async initFromUrl() {
    if (this.girderUser && this.selectedDatasetId) {
      // load after logged in
      await this.setSelectedDataset(this.selectedDatasetId);
    }
    if (this.girderUser && this.selectedConfigurationId && this.dataset) {
      // load after logged in
      await this.setSelectedConfiguration(this.selectedConfigurationId);
    }
  }

  @Action
  public async refreshDataset() {
    await this.setSelectedDataset(this.selectedDatasetId);
  }

  @Action
  async login({
    domain,
    username,
    password
  }: {
    domain: string;
    username: string;
    password: string;
  }) {
    Object.assign(this.girderRest, { apiRoot: `${domain}/api/v1` });
    /* Don't create a new client
    const restClient = new RestClient({
      apiRoot: `${domain}/api/v1`
    });
    */

    try {
      sync.setLoading(true);
      await this.girderRest.login(username, password);
      sync.setLoading(false);
    } catch (err) {
      if (!err.response || err.response.status !== 401) {
        sync.setLoading(err);
        return "Unknown error occurred";
      } else {
        const { message } = err.response.data;
        sync.setLoading(false);
        return message || "Unauthorized.";
      }
    }

    await this.loggedIn({
      girderUrl: domain,
      girderRest: this.girderRest
    });

    await this.initFromUrl();
    return null;
  }

  @Action
  async setSelectedDataset(id: string | null) {
    this.api.flushCaches();
    if (!this.isLoggedIn || !id) {
      this.setDataset({ id, data: null });
      return;
    }
    try {
      sync.setLoading(true);
      const r = await this.api.getDataset(
        id,
        this.unrollXY,
        this.unrollZ,
        this.unrollT
      );
      this.setDataset({ id, data: r });
      sync.setLoading(false);
    } catch (error) {
      sync.setLoading(error);
    }
  }

  @Action
  async setSelectedConfiguration(id: string | null) {
    if (!this.isLoggedIn || !id) {
      this.setConfiguration({ id, data: null });
      return;
    }
    try {
      sync.setLoading(true);
      const r = await this.api.getConfiguration(id);
      this.setConfiguration({ id, data: r });
      sync.setLoading(false);
    } catch (error) {
      sync.setLoading(error);
    }
  }

  @Action
  async setDatasetViewId(id: string | null) {
    if (!id) {
      this.setDatasetViewImpl(null);
    } else {
      const datasetView = await this.api.getDatasetView(id);
      datasetView.lastViewed = Date.now();
      this.setDatasetViewImpl(datasetView);
      const promises: Promise<any>[] = [
        this.api.updateDatasetView(datasetView)
      ];
      if (this.dataset?.id !== datasetView.datasetId) {
        promises.push(this.setSelectedDataset(datasetView.datasetId));
      }
      if (this.configuration?.id !== datasetView.configurationId) {
        promises.push(
          this.setSelectedConfiguration(datasetView.configurationId)
        );
      }
      await Promise.all(promises);
    }
  }

  @Mutation
  setDatasetViewImpl(datasetView: IDatasetView | null) {
    this.datasetView = datasetView;
  }

  @Action
  deleteDatasetView(datasetView: IDatasetView) {
    return this.api.deleteDatasetView(datasetView.id);
  }

  @Action
  async createDataset({
    name,
    description,
    path
  }: {
    name: string;
    description: string;
    path: IGirderSelectAble;
  }) {
    try {
      sync.setSaving(true);
      const ds = await this.api.createDataset(name, description, path);
      sync.setSaving(false);
      return ds;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
  }

  @Action
  async importDataset(path: IGirderSelectAble) {
    try {
      sync.setSaving(true);
      const ds = await this.api.importDataset(path);
      sync.setSaving(false);
      return ds;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
  }

  @Action
  async createConfiguration({
    name,
    description,
    folderId
  }: {
    name: string;
    description: string;
    folderId: string;
  }) {
    if (!this.dataset) {
      return null;
    }
    try {
      sync.setSaving(true);
      const config = await this.api.createConfigurationFromDataset(
        name,
        description,
        folderId,
        this.dataset
      );
      sync.setSaving(false);
      return config;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
  }

  @Mutation
  private deleteConfigurationImpl(configuration: IDatasetConfiguration) {
    if (this.configuration === configuration) {
      this.configuration = null;
    }
    if (this.selectedConfigurationId === configuration.id) {
      this.selectedConfigurationId = null;
    }
  }

  @Action
  async addMultiSourceMetadata({
    parentId,
    metadata
  }: {
    parentId: string;
    metadata: string;
  }) {
    const newFile = (
      await this.api.uploadJSONFile(
        "multi-source2.json",
        metadata,
        parentId,
        "folder"
      )
    ).data;

    const items = await this.api.getItems(parentId);
    const promises = items
      .filter((item: any) => !!item.largeImage && item._id !== newFile.itemId)
      .map((item: IGirderItem) => this.api.removeLargeImageForItem(item));
    await Promise.all(promises);
    return newFile.itemId;
  }

  @Action
  async deleteConfiguration(configuration: IDatasetConfiguration) {
    try {
      sync.setSaving(true);
      const promises: Promise<any>[] = [];
      promises.push(this.api.deleteConfiguration(configuration));
      const views = await this.api.findDatasetViews({
        configurationId: configuration.id
      });
      for (const { id } of views) {
        promises.push(this.api.deleteDatasetView(id));
      }
      await Promise.all(promises);
      this.deleteConfigurationImpl(configuration);
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Mutation
  private deleteDatasetImpl(dataset: IDataset) {
    if (this.dataset === dataset) {
      this.dataset = null;
      this.configuration = null;
      this.selectedConfigurationId = null;
    }
    if (this.selectedDatasetId === dataset.id) {
      this.selectedDatasetId = null;
    }
  }

  @Action
  async deleteDataset(dataset: IDataset) {
    try {
      sync.setSaving(true);
      const promises: Promise<any>[] = [];
      promises.push(this.api.deleteDataset(dataset));
      const views = await this.api.findDatasetViews({
        datasetId: dataset.id
      });
      for (const { id } of views) {
        promises.push(this.api.deleteDatasetView(id));
      }
      await Promise.all(promises);
      this.deleteDatasetImpl(dataset);
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Action
  async setXY(value: number) {
    this.setXYImpl(value);
  }

  @Action
  async setUnrollXY(value: boolean) {
    this.setUnrollXYImpl(value);
  }

  @Action
  async setZ(value: number) {
    this.setZImpl(value);
  }

  @Action
  async setUnrollZ(value: boolean) {
    this.setUnrollZImpl(value);
  }

  @Action
  async setTime(value: number) {
    this.setTimeImpl(value);
  }

  @Action
  async setUnrollT(value: boolean) {
    this.setUnrollTImpl(value);
  }

  @Mutation
  private pushLayer(layer: IDisplayLayer) {
    if (this.configuration) {
      const layers = this.configuration.layers;
      Vue.set(layers, layers.length, Object.assign({}, layer));
    }
  }

  @Mutation
  private toggleLayer(layerId: string) {
    if (!this.configuration) {
      return;
    }
    const layers = this.configuration.layers;
    switch (this.layerMode) {
      case "single":
        layers.forEach(l => (l.visible = l.id === layerId));
        break;
      case "multiple":
      case "unroll":
        const index = layers.findIndex(l => l.id === layerId);
        if (index === null) {
          break;
        }
        layers[index].visible = !layers[index].visible;
        Vue.set(layers, index, layers[index]);
        break;
    }
  }

  @Action
  updateConfigurationProperties(propertyIds: string[]) {
    if (this.configuration) {
      this.configuration.propertyIds = propertyIds;
      this.syncConfiguration("propertyIds");
    }
  }

  @Action
  async syncConfiguration(key: keyof IDatasetConfigurationBase) {
    if (!this.configuration) {
      return;
    }
    sync.setSaving(true);
    try {
      await this.api.updateConfigurationKey(this.configuration, key);
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Action
  async addLayer() {
    if (!this.configuration || !this.dataset) {
      return;
    }
    this.pushLayer(newLayer(this.dataset, this.layers));
    await this.syncConfiguration("layers");
  }

  @Mutation
  private setLayerModeImpl(mode: TLayerMode) {
    this.layerMode = mode;
  }

  @Mutation
  private verifySingleLayerMode() {
    if (!this.configuration) {
      return;
    }
    let first = true;
    this.configuration.layers.forEach(l => {
      if (l.visible) {
        if (!first) {
          l.visible = false;
        }
        first = false;
      }
    });
    if (first && this.configuration.layers.length) {
      this.configuration.layers[0].visible = true;
    }
  }

  @Action
  async setLayerMode(mode: TLayerMode) {
    this.setLayerModeImpl(mode);

    if (mode === "single") {
      this.verifySingleLayerMode();
      await this.syncConfiguration("layers");
    }
  }

  @Action
  async toggleLayerVisibility(layerId: string) {
    if (!this.dataset || !this.configuration) {
      return;
    }
    this.toggleLayer(layerId);
    await this.syncConfiguration("layers");
  }

  @Action
  async toggleGlobalZMaxMerge() {
    const layers = this.layers;
    if (!layers || !this.dataset) {
      return;
    }
    const currentZMaxMerge = layers.every(
      layer => layer.z.type === "max-merge"
    );
    const newLayerZ: IDisplaySlice = currentZMaxMerge
      ? { type: "current", value: null }
      : { type: "max-merge", value: null };
    layers.forEach(layer => (layer.z = newLayerZ));
  }

  @Action
  async toggleGlobalLayerVisibility() {
    const layers = this.layers;
    const currentVisibility = layers.every(layer => layer.visible);
    layers.forEach(layer => {
      if (layer.visible === currentVisibility) {
        this.toggleLayerVisibility(layer.id);
      }
    });
  }

  @Action
  async saveContrastInConfiguration({
    layerId,
    contrast
  }: {
    layerId: string;
    contrast: IContrast;
  }) {
    this.changeLayer({ layerId, delta: { contrast }, sync: true });
    if (this.datasetView) {
      Vue.delete(this.datasetView.layerContrasts, layerId);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Action
  async saveContrastInView({
    layerId,
    contrast
  }: {
    layerId: string;
    contrast: IContrast;
  }) {
    if (this.datasetView) {
      Vue.set(this.datasetView.layerContrasts, layerId, contrast);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Action
  async resetContrastInView(layerId: string) {
    if (this.datasetView) {
      Vue.delete(this.datasetView.layerContrasts, layerId);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Mutation
  private changeLayerImpl({
    layerId,
    delta
  }: {
    layerId: string;
    delta: Partial<IDisplayLayer>;
  }) {
    if (!this.configuration) {
      return;
    }
    const confLayers = this.configuration.layers;
    const index = confLayers.findIndex(l => l.id === layerId);
    if (index === null) {
      return;
    }
    const layer = confLayers[index];
    Vue.set(confLayers, index, Object.assign({}, layer, delta));
  }

  @Action
  async changeLayer(args: {
    layerId: string;
    delta: Partial<IDisplayLayer>;
    sync?: boolean;
  }) {
    this.changeLayerImpl(args);
    if (args.sync !== false) {
      await this.syncConfiguration("layers");
    }
  }

  @Mutation
  private removeLayerImpl(layerId: string) {
    if (!this.configuration) {
      return;
    }
    const layers = this.configuration.layers;
    const index = layers.findIndex(l => l.id === layerId);
    if (index === null) {
      return;
    }
    layers.splice(index, 1);
  }

  @Action
  async removeLayer(layerId: string) {
    this.removeLayerImpl(layerId);
    await this.syncConfiguration("layers");
  }

  get getImagesFromChannel() {
    return (channel: number) => {
      if (!this.dataset) {
        return [];
      }
      return this.dataset.images(this.z, this.time, this.xy, channel);
    };
  }

  get getImagesFromLayer() {
    return (layer: IDisplayLayer) => {
      if (!this.dataset) {
        return [];
      }
      const indexes = this.layerSliceIndexes(layer);
      if (!indexes) {
        return [];
      }
      return (
        this.dataset.images(
          indexes.zIndex,
          indexes.tIndex,
          indexes.xyIndex,
          layer.channel
        ) || []
      );
    };
  }

  get getFullLayerImages() {
    return (time: number, xy: number, z: number) => {
      let results: {
        neededHistograms: IImage[][];
        urls: string[];
        fullUrls: string[];
      } = {
        neededHistograms: [],
        urls: [],
        fullUrls: []
      };
      if (!this.dataset || !this.configuration || !this.api.histogramsLoaded) {
        return results;
      }
      this.layers.forEach(layer => {
        const images = getLayerImages(layer, this.dataset!, time, xy, z);
        const hist = this.api.getResolvedLayerHistogram(images);
        if (!hist) {
          results.neededHistograms.push(images);
        } else {
          images.forEach(image => {
            results.urls.push(
              this.api.tileTemplateUrl(
                image,
                layer.color,
                layer.contrast,
                hist,
                layer,
                this.dataset
              )!
            );
            results.fullUrls.push(
              this.api.tileTemplateUrl(
                image,
                "#ffffff",
                {
                  mode: "percentile",
                  blackPoint: 0,
                  whitePoint: 100
                },
                hist,
                layer,
                this.dataset
              )!
            );
          });
        }
      });
      return results;
    };
  }

  get layerStackImages() {
    if (!this.dataset || !this.configuration || !this.api.histogramsLoaded) {
      return [];
    }

    return this.layers.map(layer => {
      const images = getLayerImages(
        layer,
        this.dataset!,
        this.time,
        this.xy,
        this.z
      );
      const hist = this.api.getResolvedLayerHistogram(images);
      const singleFrame =
        layer.xy.type !== "max-merge" &&
        layer.time.type !== "max-merge" &&
        layer.z.type !== "max-merge" &&
        images.length === 1;
      const results: ILayerStackImage = {
        layer,
        images,
        urls: images.map(image =>
          this.api.tileTemplateUrl(
            image,
            layer.color,
            layer.contrast,
            hist,
            layer,
            this.dataset
          )
        ),
        fullUrls: images.map(image =>
          this.api.tileTemplateUrl(
            image,
            "#ffffff",
            {
              mode: "percentile",
              blackPoint: 0,
              whitePoint: 100
            },
            hist,
            layer,
            this.dataset
          )
        ),
        hist,
        singleFrame: singleFrame ? images[0].frameIndex : null
      };
      if (results.fullUrls && results.fullUrls.length && results.fullUrls[0]) {
        results.baseQuadOptions = {
          baseUrl: results.fullUrls[0].split("/tiles")[0] + "/tiles",
          restRequest: (params: any) =>
            this.api.client
              .get(params.url, { params: params.data })
              .then(data => data.data),
          restUrl:
            "item/" +
            results.fullUrls[0].split("/tiles")[0].split("item/")[1] +
            "/tiles",
          maxTextures: 32,
          maxTextureSize: 4096,
          query:
            "style=" +
            encodeURIComponent(
              JSON.stringify({
                min: "min",
                max: "max",
                palette: ["#000000", "#ffffff"]
              })
            ) +
            "&cache=true"
        };
        let anyImage = this.dataset!.anyImage();
        if (
          anyImage &&
          anyImage.tileinfo &&
          anyImage.tileinfo.IndexStride &&
          anyImage.tileinfo.IndexStride.IndexC === 1 &&
          anyImage.tileinfo.IndexRange &&
          anyImage.tileinfo.IndexRange.IndexC > 1
        ) {
          results.baseQuadOptions.frameBase = layer.channel;
          results.baseQuadOptions.frameStride =
            anyImage.tileinfo.IndexRange.IndexC;
          results.baseQuadOptions.frameGroup =
            anyImage.tileinfo.IndexRange.IndexZ || 1;
          if (
            (anyImage.tileinfo.IndexStride || {}).IndexZ &&
            (anyImage.tileinfo.IndexStride || {}).IndexC &&
            anyImage.tileinfo.IndexStride.IndexZ >
              anyImage.tileinfo.IndexRange.IndexC
          ) {
            results.baseQuadOptions.frameGroupStride =
              anyImage.tileinfo.IndexStride.IndexZ /
              anyImage.tileinfo.IndexRange.IndexC;
          }
        }
      }
      return results;
    });
  }

  get getLayerHistogram() {
    // need to be like that to be detected as a getter
    return (layer: IDisplayLayer) => {
      if (!this.dataset || !this.configuration) {
        return Promise.resolve(null);
      }

      if (!layer._histogram) {
        layer._histogram = {
          promise: Promise.resolve(null),
          lastHistogram: null,
          lastImages: null,
          nextImages: null,
          lock: false
        };
      }

      // debounce histogram calls
      let nextHistogram = () => {
        if (
          layer._histogram &&
          !layer._histogram.lock &&
          layer._histogram.nextImages !== null
        ) {
          const histogramObj = layer._histogram;
          const images = layer._histogram.nextImages;
          histogramObj.nextImages = null;
          histogramObj.lock = true;
          histogramObj.promise = this.api.getLayerHistogram(images);
          histogramObj.promise.then(value => {
            histogramObj.lastHistogram = value;
          });
          histogramObj.promise.catch(() => {
            histogramObj.lastHistogram = null;
          });
          histogramObj.promise.finally(() => {
            histogramObj.lastImages = images;
            histogramObj.lock = false;
            nextHistogram();
          });
        }
        return null;
      };

      const lastImages = layer._histogram.lastImages;
      const nextImages = getLayerImages(
        layer,
        this.dataset,
        this.time,
        this.xy,
        this.z
      );

      if (
        lastImages === null ||
        nextImages.length !== lastImages.length ||
        nextImages.some((image, idx) => image !== lastImages[idx])
      ) {
        layer._histogram.nextImages = nextImages;
        nextHistogram();
      }
      return layer._histogram.promise;
    };
  }

  get getLayerFromId() {
    return (layerId: string | undefined) =>
      layerId === undefined
        ? undefined
        : this.layers.find(layer => layer.id === layerId);
  }

  get getConfigurationLayerFromId() {
    return (layerId: string) =>
      this.configuration?.layers.find(layer => layer.id === layerId);
  }

  get getLayerIndexFromId() {
    return (layerId: string) => {
      const index = this.configuration?.layers.findIndex(
        layer => layer.id === layerId
      );
      if (index === undefined || index < 0) {
        return null;
      }
      return index;
    };
  }

  @Mutation
  public setSnapshotImpl(value?: string) {
    // check if snapshot is available.  If not, set to undefined
    this.snapshot = value;
    // TODO: also load the snapshot
  }

  @Action
  async setSnapshot(value?: string) {
    this.setSnapshotImpl(value);
  }

  @Action
  async syncSnapshots() {
    if (!this.configuration) {
      return;
    }
    await this.syncConfiguration("snapshots");
  }

  @Action
  async addSnapshot(snapshot: ISnapshot) {
    if (!this.configuration) {
      return;
    }
    let snapshots = (this.configuration.snapshots || []).filter(
      d => d.name !== snapshot.name
    );
    snapshots.push(snapshot);
    this.configuration.snapshots = snapshots;
    await this.syncSnapshots();
  }

  @Action
  async removeSnapshot(name: string) {
    if (!this.configuration) {
      return;
    }
    let snapshots = (this.configuration.snapshots || []).filter(
      d => d.name !== name
    );
    this.configuration.snapshots = snapshots;
    await this.syncSnapshots();
  }

  @Action
  async setConfigurationLayers(layers: IDisplayLayer[]) {
    if (!this.configuration) {
      return;
    }
    this.configuration.layers = [];
    layers.forEach(this.pushLayer);
    await this.syncConfiguration("layers");
  }

  @Mutation
  resetDatasetViewContrasts() {
    if (!this.datasetView) {
      return;
    }
    Vue.set(this.datasetView, "layerContrasts", {});
    this.api.updateDatasetView(this.datasetView);
  }

  @Mutation
  setDatasetViewContrasts(contrasts: IDatasetView["layerContrasts"]) {
    if (!this.datasetView) {
      return;
    }
    Vue.set(this.datasetView, "layerContrasts", contrasts);
    this.api.updateDatasetView(this.datasetView);
  }

  @Action
  async loadSnapshotLayers(snapshot: ISnapshot) {
    await this.setLayerMode(snapshot.layerMode);
    await this.loadLayersContrastsInDatasetView(snapshot.layers);
    await this.loadLayersVisibilityInConfiguration(snapshot.layers);
  }

  @Action
  async loadLayersVisibilityInConfiguration(layers: IDisplayLayer[]) {
    for (const layer of layers) {
      this.changeLayer({
        layerId: layer.id,
        delta: { visible: layer.visible },
        sync: false
      });
    }
    await this.syncConfiguration("layers");
  }

  @Action
  async loadLayersContrastsInDatasetView(layers: IDisplayLayer[]) {
    const contrasts: IDatasetView["layerContrasts"] = {};
    for (const layer of layers) {
      contrasts[layer.id] = layer.contrast;
    }
    this.setDatasetViewContrasts(contrasts);
  }

  @Action
  async scheduleTileFramesComputation(datasetId: string) {
    return this.api.scheduleTileFramesComputation(datasetId);
  }

  @Action
  async scheduleMaxMergeCache(datasetId: string) {
    return this.api.scheduleMaxMergeCache(datasetId);
  }
}

const main = getModule(Main);

export default main;
