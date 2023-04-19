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

  get layers() {
    const configurationLayers = this.configuration?.layers || [];
    // Use contrast from dataset view
    return configurationLayers.map(layer => {
      const contrast = this.datasetView?.layerContrasts[layer.id];
      return contrast ? { ...layer, contrast } : layer;
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
    if (this.configuration) {
      this.configuration.tools = this.tools.filter(t => t.id !== toolId);
      this.syncConfiguration("tools");
    }
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

    if (this.dataset) {
      if (!this.dataset.configurations.find(d => d.id === data.id)) {
        this.dataset.configurations.push(data);
      }
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
        this.api.updateDatasetView(datasetView),
        this.setSelectedDataset(datasetView.datasetId),
        this.setSelectedConfiguration(datasetView.configurationId)
      ];
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
    description
  }: {
    name: string;
    description: string;
  }) {
    if (!this.dataset) {
      return null;
    }
    try {
      sync.setSaving(true);
      const config = await this.api.createConfigurationFromDataset(
        name,
        description,
        this.dataset.id,
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
    if (this.dataset) {
      const index = this.dataset.configurations.findIndex(
        d => d.id === configuration.id
      );
      if (index >= 0) {
        this.dataset.configurations.splice(index, 1);
      }
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
  private toggleLayer(index: number) {
    if (!this.configuration) {
      return;
    }
    const layers = this.configuration.layers;
    switch (this.layerMode) {
      case "single":
        layers.forEach((l, i) => (l.visible = i === index));
        break;
      case "multiple":
      case "unroll":
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
  async toggleLayerVisibility(layerIndex: number) {
    if (
      !this.dataset ||
      !this.configuration ||
      layerIndex < 0 ||
      layerIndex >= this.layers.length
    ) {
      return;
    }
    this.toggleLayer(layerIndex);
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
    layers.forEach((layer, layerIdx) => {
      if (layer.visible === currentVisibility) {
        this.toggleLayerVisibility(layerIdx);
      }
    });
  }

  @Action
  async saveContrastInConfiguration({
    index,
    contrast
  }: {
    index: number;
    contrast: IContrast;
  }) {
    this.changeLayer({ index, delta: { contrast }, sync: true });
    if (this.datasetView) {
      Vue.delete(this.datasetView.layerContrasts, this.layers[index].id);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Action
  async saveContrastInView({
    index,
    contrast
  }: {
    index: number;
    contrast: IContrast;
  }) {
    if (this.datasetView) {
      Vue.set(this.datasetView.layerContrasts, this.layers[index].id, contrast);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Mutation
  private changeLayerImpl({
    index,
    delta
  }: {
    index: number;
    delta: Partial<IDisplayLayer>;
  }) {
    if (
      !this.configuration ||
      index < 0 ||
      index >= this.configuration.layers.length
    ) {
      return;
    }
    Vue.set(
      this.configuration.layers,
      index,
      Object.assign({}, this.configuration.layers[index], delta)
    );
  }

  @Action
  async changeLayer(args: {
    index: number;
    delta: Partial<IDisplayLayer>;
    sync?: boolean;
  }) {
    this.changeLayerImpl(args);
    if (args.sync !== false) {
      await this.syncConfiguration("layers");
    }
  }

  @Mutation
  private removeLayerImpl(index: number) {
    if (
      !this.configuration ||
      index < 0 ||
      index >= this.configuration.layers.length
    ) {
      return;
    }
    this.configuration.layers.splice(index, 1);
  }

  @Action
  async removeLayer(index: number) {
    this.removeLayerImpl(index);
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
    return (layerIdx: number) => {
      if (!this.dataset) {
        return [];
      }
      const layer = this.layers[layerIdx];
      if (!layer) {
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
                  whitePoint: 100,
                  savedBlackPoint: 0,
                  savedWhitePoint: 100
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
              whitePoint: 100,
              savedBlackPoint: 0,
              savedWhitePoint: 100
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

  @Mutation
  public loadSnapshotImpl(snapshot: { [key: string]: any }) {
    this.unrollXY = snapshot.unrollXY;
    this.unrollZ = snapshot.unrollZ;
    this.unrollT = snapshot.unrollT;
    this.xy = snapshot.xy;
    this.z = snapshot.z;
    this.time = snapshot.time;
    this.layerMode = snapshot.layerMode;
  }

  @Action
  async loadSnapshot(name: string): Promise<ISnapshot | undefined> {
    if (!this.configuration || !this.dataset) {
      return;
    }
    const snapshot = this.configuration.snapshots?.find(d => d.name == name);
    if (!snapshot) {
      return;
    }
    this.configuration.layers = [];
    snapshot.layers.forEach(this.pushLayer);
    this.loadSnapshotImpl(snapshot);
    await this.syncConfiguration("layers");
    // note that this doesn't set viewport, snapshot name, description, tags,
    // map rotation, or screenshot parameters
    return snapshot;
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
