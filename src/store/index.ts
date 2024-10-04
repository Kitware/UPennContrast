import {
  RestClient,
  RestClientInstance,
  IGirderItem,
  IGirderLocation,
  IGirderAssetstore,
  IGirderSelectAble,
  IGirderUser,
} from "@/girder";
import type { AxiosError } from "axios";
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule,
} from "vuex-module-decorators";

import AnnotationsAPI from "./AnnotationsAPI";
import PropertiesAPI from "./PropertiesAPI";
import ChatAPI from "./ChatAPI";
import GirderAPI from "./GirderAPI";

import { getLayerImages, getLayerSliceIndexes } from "./images";
import jobs from "./jobs";

import {
  IDataset,
  IDatasetConfiguration,
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
  IContrast,
  IMapEntry,
  IHistoryEntry,
  IJobEventData,
  IScales,
  TUnitLength,
  TUnitTime,
  IScaleInformation,
  exampleConfigurationBase,
  IActiveTool,
  TToolType,
  BaseToolStateSymbol,
  TToolState,
  ICameraInfo,
  IDatasetLocation,
  ConnectionToolStateSymbol,
} from "./model";

import persister from "./Persister";
import store from "./root";
import sync from "./sync";
import { MAX_NUMBER_OF_RECENT_DATASET_VIEWS } from "./constants";
import Vue from "vue";
export { default as store } from "./root";
import { app } from "@/main";

import { Debounce } from "@/utils/debounce";
import { TCompositionMode } from "@/utils/compositionModes";
import { createSamToolStateFromToolConfiguration } from "@/pipelines/samPipeline";
import { isEqual } from "lodash";
import { logError } from "@/utils/log";

const apiRootSuffix = "/api/v1";
const defaultGirderUrl =
  import.meta.env.VITE_GIRDER_URL || "http://localhost:8080";

export function girderUrlFromApiRoot(apiRoot: string): string {
  if (apiRoot.endsWith(apiRootSuffix)) {
    return apiRoot.slice(0, apiRoot.length - apiRootSuffix.length);
  }
  return apiRoot;
}

function apiRootFromGirderUrl(girderUrl: string) {
  return girderUrl + apiRootSuffix;
}

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  girderRest = new RestClient({
    apiRoot: apiRootFromGirderUrl(persister.get("girderUrl", defaultGirderUrl)),
  });

  // Use a proxy to dynamically resolve to the right girderRest client
  girderRestProxy = new Proxy(this, {
    get(obj: Main, prop: keyof RestClientInstance) {
      return obj.girderRest[prop];
    },
    set() {
      throw new Error("The rest client proxy is read-only.");
    },
  }) as unknown as RestClientInstance;

  api = new GirderAPI(this.girderRestProxy);
  annotationsAPI = new AnnotationsAPI(this.girderRestProxy);
  propertiesAPI = new PropertiesAPI(this.girderRestProxy);
  chatAPI = new ChatAPI(this.girderRestProxy);

  girderUser: IGirderUser | null = this.girderRest.user;
  folderLocation: IGirderLocation = this.girderUser || { type: "users" };
  assetstores: IGirderAssetstore[] = [];

  history: IHistoryEntry[] = [];

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

  cameraInfo: ICameraInfo = {
    center: { x: 0, y: 0 },
    zoom: 1,
    rotate: 0,
    gcsBounds: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  };

  drawAnnotations: boolean = true;
  filteredDraw: boolean = true;
  annotationSelectionType: AnnotationSelectionTypes =
    AnnotationSelectionTypes.TOGGLE;

  showAnnotationsFromHiddenLayers: boolean = true;

  showTooltips: boolean = false;
  filteredAnnotationTooltips: boolean = false;

  valueOnHover: boolean = true;
  overview: boolean = true;
  hoverValue: { [layerId: string]: number[] } | null = null;

  showScalebar: boolean = true;
  showPixelScalebar: boolean = true;

  scaleAnnotationsWithZoom: boolean = true;

  annotationsRadius: number = 10;

  compositionMode: TCompositionMode = "lighten";
  backgroundColor: string = "black";

  restrictAnnotationsToFilters: boolean = true;
  restrictAnnotationsToActive: boolean = true;
  drawAnnotationConnections: boolean = true;

  unrollXY: boolean = false;
  unrollZ: boolean = false;
  unrollT: boolean = false;

  maps: IMapEntry[] = [];

  isAnnotationPanelOpen: boolean = false;
  annotationPanelBadge: boolean = false;
  isHelpPanelOpen: boolean = false;

  toolTemplateList: any[] = [];
  selectedTool: IActiveTool | null = null;
  readonly availableToolShapes: { value: string; text: string }[] = [
    {
      text: AnnotationNames[AnnotationShape.Point],
      value: AnnotationShape.Point,
    },
    {
      text: AnnotationNames[AnnotationShape.Polygon],
      value: AnnotationShape.Polygon,
    },
    {
      text: AnnotationNames[AnnotationShape.Line],
      value: AnnotationShape.Line,
    },
  ];

  get tools() {
    return this.configuration?.tools || [];
  }

  get toolTags() {
    const tagSet: Set<string> = new Set();
    for (const tool of this.tools) {
      if (tool.values?.annotation?.tags) {
        const tags = tool.values.annotation.tags;
        for (const tag of tags) {
          tagSet.add(tag);
        }
      }
    }
    return tagSet;
  }

  get layers(): IDisplayLayer[] {
    const configurationLayers = this.configuration?.layers || [];
    // Use contrast from dataset view
    return configurationLayers.map((layer) => {
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

  get configurationScales() {
    return this.configuration?.scales || exampleConfigurationBase().scales;
  }

  get viewScales() {
    return this.datasetView?.scales || {};
  }

  get scales() {
    return { ...this.configurationScales, ...this.viewScales };
  }

  get currentLocation(): IDatasetLocation {
    return {
      xy: this.xy,
      z: this.z,
      time: this.time,
    };
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
        this.z,
      );
    };
  }

  @Mutation
  setAssetstores(assetstores: IGirderAssetstore[]) {
    this.assetstores = assetstores;
  }

  @Mutation
  setFolderLocation(location: IGirderLocation) {
    this.folderLocation = location;
  }

  @Mutation
  public setMaps(maps: IMapEntry[]) {
    this.maps = maps;
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
  public setShowAnnotationsFromHiddenLayers(value: boolean) {
    this.showAnnotationsFromHiddenLayers = value;
  }

  get shouldShowAnnotationsFromHiddenLayers() {
    return this.showAnnotationsFromHiddenLayers;
  }

  @Mutation
  public setValueOnHover(value: boolean) {
    this.valueOnHover = value;
  }

  @Mutation
  public setShowScalebar(value: boolean) {
    this.showScalebar = value;
  }

  @Mutation
  public setShowPixelScalebar(value: boolean) {
    this.showPixelScalebar = value;
  }

  @Mutation
  public setCompositionMode(value: TCompositionMode) {
    this.compositionMode = value;
  }

  @Mutation
  public setBackgroundColor(value: string) {
    this.backgroundColor = value;
  }

  @Mutation
  public setScaleAnnotationsWithZoom(value: boolean) {
    this.scaleAnnotationsWithZoom = value;
  }

  @Mutation
  public setAnnotationsRadius(value: number) {
    this.annotationsRadius = value;
  }

  @Mutation
  public setOverview(value: boolean) {
    this.overview = value;
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
  private setSelectedToolImpl<T extends TToolType>(
    configuration: IToolConfiguration<T> | null,
  ) {
    if (configuration === null) {
      this.selectedTool = null;
    } else if (this.selectedTool?.configuration.id === configuration.id) {
      // Update the configuration but not the state
      Vue.set(this.selectedTool, "configuration", configuration);
    } else {
      let state: TToolState;
      switch (configuration.type) {
        case "samAnnotation":
          state = createSamToolStateFromToolConfiguration(
            configuration as IToolConfiguration<"samAnnotation">,
          );
          break;
        case "connection":
          state = {
            type: ConnectionToolStateSymbol,
            selectedAnnotationId: null,
          };
          break;
        default:
          state = { type: BaseToolStateSymbol };
          break;
      }
      this.selectedTool = { configuration, state };
    }
  }

  @Action
  setSelectedToolId(id: string | null) {
    let tool: IToolConfiguration | null = null;
    if (id) {
      tool = this.tools.find((t) => t.id === id) || null;
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
    if (this.selectedTool?.configuration.id === toolId) {
      this.setSelectedToolId(null);
    }
    if (this.configuration) {
      this.configuration.tools = this.tools.filter((t) => t.id !== toolId);
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
    if (this.selectedTool?.configuration.id === tool.id) {
      this.setSelectedToolImpl(tool);
    }
    this.syncConfiguration("tools");
  }

  @Action
  protected async loggedIn(girderRest: RestClientInstance) {
    this.setGirderRest(girderRest);
    const user = this.girderUser;
    const promises = [];
    if (user) {
      promises.push(
        this.api.getUserPrivateFolder(user._id).then((privateFolder) => {
          if (privateFolder) {
            this.setFolderLocation(privateFolder);
          } else {
            this.setFolderLocation(user);
          }
        }),
        this.api
          .getAssetstores()
          .then((assetstores) => this.setAssetstores(assetstores))
          .catch(() => {
            this.setAssetstores([]);
          }),
      );
    } else {
      this.setAssetstores([]);
    }
    promises.push(
      this.setSelectedConfiguration(this.selectedConfigurationId),
      this.setSelectedDataset(this.selectedDatasetId),
      this.fetchRecentDatasetViews(),
    );
    await Promise.allSettled(promises);
  }

  @Mutation
  protected setGirderRest(girderRest: RestClientInstance) {
    this.girderRest = girderRest;
    this.girderUser = girderRest.user;
    const girderUrl = girderUrlFromApiRoot(girderRest.apiRoot);
    persister.set("girderUrl", girderUrl);
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
    data,
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
    data,
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
    data,
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
  protected setHistory(history: IHistoryEntry[]) {
    this.history = history;
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
  private setCameraInfoImpl(value: ICameraInfo) {
    this.cameraInfo = value;
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

  @Mutation
  public setIsHelpPanelOpen(value: boolean) {
    this.isHelpPanelOpen = value;
  }

  @Action
  async logout() {
    sync.setSaving(true);
    try {
      await this.girderRest.logout();
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error as Error);
    }
    this.loggedOut();
  }

  @Mutation
  private setRecentDatasetViewsImpl(recentDatasetViews: IDatasetView[]) {
    this.recentDatasetViews = recentDatasetViews;
  }

  @Action
  createDatasetView({
    datasetId,
    configurationId,
  }: {
    datasetId: string;
    configurationId: string;
  }) {
    return this.api.createDatasetView({
      datasetId,
      configurationId,
      layerContrasts: {},
      scales: {},
      lastViewed: Date.now(),
      lastLocation: {
        xy: this.xy,
        z: this.z,
        time: this.time,
      },
    });
  }

  @Action
  async fetchRecentDatasetViews() {
    try {
      const recentDatasetViews = await this.api.getRecentDatasetViews(
        MAX_NUMBER_OF_RECENT_DATASET_VIEWS,
      );
      this.setRecentDatasetViewsImpl(recentDatasetViews);
    } catch {
      this.setRecentDatasetViewsImpl([]);
    }
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
        await this.loggedIn(this.girderRest);
      }
      await this.initFromUrl();
      sync.setLoading(false);
    } catch (error) {
      sync.setLoading(error as Error);
    }
  }

  @Action
  setupWatchers() {
    store.watch(
      (state: any) => state.annotation.annotations,
      this.fetchHistory,
    );
    store.watch(
      (state: any) => state.annotation.annotationConnections,
      this.fetchHistory,
    );
    store.watch(
      (state: any) => state.properties.propertyValues,
      () => this.context.dispatch("updateDisplayedFromComputedProperties"),
    );
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
    password,
  }: {
    domain: string;
    username: string;
    password: string;
  }) {
    const restClient = new RestClient({
      apiRoot: apiRootFromGirderUrl(domain),
    });

    try {
      sync.setLoading(true);
      await restClient.login(username, password);
      sync.setLoading(false);
    } catch (error) {
      const err = error as any;
      if (!err.response || err.response.status !== 401) {
        sync.setLoading(err);
        return "Unknown error occurred";
      } else {
        const { message } = err.response.data;
        sync.setLoading(false);
        return message || "Unauthorized.";
      }
    }

    await this.loggedIn(restClient);
    await this.initFromUrl();
  }

  @Action
  async signUp({
    domain,
    ...user
  }: {
    domain: string;
    login: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    admin: boolean;
  }): Promise<void> {
    const restClient = new RestClient({
      apiRoot: apiRootFromGirderUrl(domain),
    });

    const formData = new FormData();
    formData.append("login", user.login);
    formData.append("email", user.email);
    formData.append("firstName", user.firstName);
    formData.append("lastName", user.lastName);
    formData.append("password", user.password);
    formData.append("admin", `${user.admin}`);

    try {
      await restClient.post("user", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          accept: "application/json",
        },
      });
    } catch (unknownError: unknown) {
      // Assume this is an object that looks like an AxiosError
      const error = unknownError as Partial<AxiosError>;
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        const responseData = error.response.data as { message: string };
        throw new Error(responseData.message || "An error occurred");
      }
      if (error.request) {
        // The request was made but no response was received
        throw new Error(
          "No response received from server. Please try again later.",
        );
      }
      // Something happened in setting up the request that triggered an Error
      throw new Error("An unexpected error occurred. Please try again later.");
    }

    this.setGirderRest(restClient);
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
      const r = await this.context.dispatch("getDataset", {
        id,
        unrollXY: this.unrollXY,
        unrollZ: this.unrollZ,
        unrollT: this.unrollT,
      });
      this.setDataset({ id, data: r });
      sync.setLoading(false);
    } catch (error) {
      sync.setLoading(error as Error);
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
      const configuration = await this.context.dispatch("getConfiguration", id);
      if (!configuration) {
        this.setConfiguration({ id: null, data: null });
      } else {
        this.setConfiguration({ id, data: configuration });
      }
      sync.setLoading(false);
    } catch (error) {
      sync.setLoading(error as Error);
    }
  }

  @Action
  async setDatasetViewId(id: string | null) {
    if (!id) {
      this.setDatasetViewImpl(null);
    } else {
      let datasetView: IDatasetView;
      try {
        datasetView = await this.api.getDatasetView(id);
      } catch (err) {
        // The datasetView doesn't exist
        logError(
          `Failed to fetch dataset view ${id}.\nIt may be because it has been deleted or that you don't have the access is forbidden.\n`,
          err,
        );
        return;
      }
      datasetView.lastViewed = Date.now();
      this.setDatasetViewImpl(datasetView);
      const promises: Promise<any>[] = [
        this.api.updateDatasetView(datasetView),
      ];

      const newLocation = datasetView.lastLocation;
      const query = app.$route.query;
      promises.push(
        this.setXY(query.xy == null ? newLocation.xy : Number(query.xy)),
        this.setZ(query.z == null ? newLocation.z : Number(query.z)),
        this.setTime(
          query.time == null ? newLocation.time : Number(query.time),
        ),
      );

      if (this.dataset?.id !== datasetView.datasetId) {
        promises.push(this.setSelectedDataset(datasetView.datasetId));
      }
      if (this.configuration?.id !== datasetView.configurationId) {
        promises.push(
          this.setSelectedConfiguration(datasetView.configurationId),
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
    path,
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
      sync.setSaving(error as Error);
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
      sync.setSaving(error as Error);
    }
    return null;
  }

  @Action
  async createConfiguration({
    name,
    description,
    folderId,
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
        this.dataset,
      );
      sync.setSaving(false);
      return config;
    } catch (error) {
      sync.setSaving(error as Error);
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
    metadata,
    transcode,
    eventCallback,
  }: {
    parentId: string;
    metadata: string;
    transcode: boolean;
    eventCallback?: (data: IJobEventData) => void;
  }) {
    try {
      sync.setSaving(true);
      const newFile = (
        await this.api.uploadJSONFile(
          "multi-source2.json",
          metadata,
          parentId,
          "folder",
        )
      ).data;
      const itemId: string = newFile.itemId;

      const items = await this.api.getItems(parentId);

      // When transcoding, remove all large image
      // Otherwise, remove large image only for items that are large image but not the uploaded one
      const itemsToRemoveLargeImage = transcode
        ? items
        : items.filter((item: any) => !!item.largeImage && item._id !== itemId);
      const removePromises = itemsToRemoveLargeImage.map((item: IGirderItem) =>
        this.api.removeLargeImageForItem(item._id),
      );
      await Promise.all(removePromises);

      // When transcoding, force the regeneration of large image for the new file
      if (transcode) {
        const response = await this.api.generateTiles(itemId, true, true);
        const jobId = response.data?._id;
        if (!jobId) {
          throw new Error(
            "Failed to transcode the large image: no job received",
          );
        }
        const success = await jobs.addJob({
          jobId,
          datasetId: parentId,
          eventCallback,
        });
        if (!success) {
          throw new Error("Failed to transcode the large image: job failed");
        }
      }
      return itemId;
    } catch (error) {
      sync.setSaving(error as Error);
      return null;
    }
  }

  @Action
  async deleteConfiguration(configuration: IDatasetConfiguration) {
    try {
      sync.setSaving(true);
      const promises: Promise<any>[] = [];
      promises.push(this.api.deleteConfiguration(configuration));
      const views = await this.api.findDatasetViews({
        configurationId: configuration.id,
      });
      for (const { id } of views) {
        promises.push(this.api.deleteDatasetView(id));
      }
      await Promise.allSettled(promises);
      await this.context.dispatch("ressourceDeleted", configuration.id);
      this.deleteConfigurationImpl(configuration);
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error as Error);
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
        datasetId: dataset.id,
      });
      for (const { id } of views) {
        promises.push(this.api.deleteDatasetView(id));
      }
      await Promise.all(promises);
      this.deleteDatasetImpl(dataset);
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error as Error);
    }
  }

  @Action
  @Debounce(100, { leading: false, trailing: true })
  async fetchHistory() {
    const datasetId = this.dataset?.id;
    if (datasetId !== undefined) {
      const history = await this.api.getHistoryEntries(datasetId);
      this.setHistory(history);
    } else {
      this.setHistory([]);
    }
  }

  @Mutation
  setLastLocationInDatasetView(location: IDatasetView["lastLocation"]) {
    if (!this.datasetView) {
      return;
    }
    Vue.set(this.datasetView, "lastLocation", location);
  }

  @Action
  @Debounce(5000, { leading: false, trailing: true })
  async updateLastLocationInDatasetView() {
    const location = this.currentLocation;
    if (!this.datasetView || isEqual(this.datasetView.lastLocation, location)) {
      return;
    }
    this.setLastLocationInDatasetView(location);
    await this.api.updateDatasetView(this.datasetView);
  }

  @Action
  async setXY(value: number) {
    this.setXYImpl(value);
    this.updateLastLocationInDatasetView();
  }

  @Action
  async setUnrollXY(value: boolean) {
    this.setUnrollXYImpl(value);
  }

  @Action
  async setZ(value: number) {
    this.setZImpl(value);
    this.updateLastLocationInDatasetView();
  }

  @Action
  async setUnrollZ(value: boolean) {
    this.setUnrollZImpl(value);
  }

  @Action
  async setTime(value: number) {
    this.setTimeImpl(value);
    this.updateLastLocationInDatasetView();
  }

  @Action
  async setCameraInfo(value: ICameraInfo) {
    this.setCameraInfoImpl(value);
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
        layers.forEach((l) => (l.visible = l.id === layerId));
        break;
      case "multiple":
      case "unroll":
        const index = layers.findIndex((l) => l.id === layerId);
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
      this.context.dispatch("ressourceChanged", this.configuration.id);
      sync.setSaving(false);
    } catch (error) {
      sync.setSaving(error as Error);
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
    this.configuration.layers.forEach((l) => {
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
      (layer) => layer.z.type === "max-merge",
    );
    const newLayerZ: IDisplaySlice = currentZMaxMerge
      ? { type: "current", value: null }
      : { type: "max-merge", value: null };
    layers.forEach((layer) =>
      this.changeLayer({
        layerId: layer.id,
        delta: {
          z: { ...newLayerZ },
        },
      }),
    );
  }

  @Action
  async toggleGlobalLayerVisibility() {
    const layers = this.layers;
    const currentVisibility = layers.every((layer) => layer.visible);
    layers.forEach((layer) => {
      if (layer.visible === currentVisibility) {
        this.toggleLayerVisibility(layer.id);
      }
    });
  }

  @Action
  async saveContrastInConfiguration({
    layerId,
    contrast,
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
    contrast,
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

  @Action
  saveScaleInConfiguration({
    itemId,
    scale,
  }: {
    itemId: keyof IScales;
    scale: IScaleInformation<TUnitLength | TUnitTime>;
  }) {
    if (this.configuration) {
      Vue.set(this.configuration.scales, itemId, scale);
      this.syncConfiguration("scales");
    }
  }

  @Action
  saveScalesInView({
    itemId,
    scale,
  }: {
    itemId: keyof IScales;
    scale: IScaleInformation<TUnitLength | TUnitTime>;
  }) {
    if (this.datasetView) {
      Vue.set(this.datasetView.scales, itemId, scale);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Action
  resetScalesInView(itemId: keyof IScales) {
    if (this.datasetView) {
      Vue.delete(this.datasetView.scales, itemId);
      this.api.updateDatasetView(this.datasetView);
    }
  }

  @Mutation
  private changeLayerImpl({
    layerId,
    delta,
  }: {
    layerId: string;
    delta: Partial<IDisplayLayer>;
  }) {
    if (!this.configuration) {
      return;
    }
    const confLayers = this.configuration.layers;
    const index = confLayers.findIndex((l) => l.id === layerId);
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
    const index = layers.findIndex((l) => l.id === layerId);
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
          layer.channel,
        ) || []
      );
    };
  }

  get getFullLayerImages() {
    return (time: number, xy: number, z: number) => {
      const results: {
        neededHistograms: IImage[][];
        urls: string[];
        fullUrls: string[];
      } = {
        neededHistograms: [],
        urls: [],
        fullUrls: [],
      };
      if (!this.dataset || !this.configuration || !this.api.histogramsLoaded) {
        return results;
      }
      this.layers.forEach((layer) => {
        const images = getLayerImages(layer, this.dataset!, time, xy, z);
        const hist = this.api.getResolvedLayerHistogram(images);
        if (!hist) {
          results.neededHistograms.push(images);
        } else {
          images.forEach((image) => {
            results.urls.push(
              this.api.tileTemplateUrl(
                image,
                layer.color,
                layer.contrast,
                hist,
                layer,
                this.dataset,
              )!,
            );
            results.fullUrls.push(
              this.api.tileTemplateUrl(
                image,
                "#ffffff",
                {
                  mode: "percentile",
                  blackPoint: 0,
                  whitePoint: 100,
                },
                hist,
                layer,
                this.dataset,
              )!,
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

    return this.layers.map((layer) => {
      const images = getLayerImages(
        layer,
        this.dataset!,
        this.time,
        this.xy,
        this.z,
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
        urls: images.map((image) =>
          this.api.tileTemplateUrl(
            image,
            layer.color,
            layer.contrast,
            hist,
            layer,
            this.dataset,
          ),
        ),
        fullUrls: images.map((image) =>
          this.api.tileTemplateUrl(
            image,
            "#ffffff",
            {
              mode: "percentile",
              blackPoint: 0,
              whitePoint: 100,
            },
            hist,
            layer,
            this.dataset,
          ),
        ),
        hist,
        singleFrame: singleFrame ? images[0].frameIndex : null,
      };
      if (results.fullUrls && results.fullUrls.length && results.fullUrls[0]) {
        results.baseQuadOptions = {
          baseUrl: results.fullUrls[0].split("/tiles")[0] + "/tiles",
          restRequest: (params: any) =>
            this.girderRest
              .get(params.url, { params: params.data })
              .then((data) => data.data),
          restUrl:
            "item/" +
            results.fullUrls[0].split("/tiles")[0].split("item/")[1] +
            "/tiles",
          queryParameters: {
            maxTextures: 32,
            maxTextureSize: 4096,
            query:
              "style=" +
              encodeURIComponent(
                JSON.stringify({
                  min: "min",
                  max: "max",
                  palette: ["#000000", "#ffffff"],
                }),
              ) +
              "&cache=true",
          },
        };
        const anyImage = this.dataset!.anyImage();
        if (
          anyImage &&
          anyImage.tileinfo &&
          anyImage.tileinfo.IndexStride &&
          anyImage.tileinfo.IndexStride.IndexC === 1 &&
          anyImage.tileinfo.IndexRange &&
          anyImage.tileinfo.IndexRange.IndexC > 1
        ) {
          const query = results.baseQuadOptions.queryParameters;
          query.frameBase = layer.channel;
          query.frameStride = anyImage.tileinfo.IndexRange.IndexC;
          query.frameGroup = anyImage.tileinfo.IndexRange.IndexZ || 1;
          if (
            (anyImage.tileinfo.IndexStride || {}).IndexZ &&
            (anyImage.tileinfo.IndexStride || {}).IndexC &&
            anyImage.tileinfo.IndexStride.IndexZ >
              anyImage.tileinfo.IndexRange.IndexC
          ) {
            query.frameGroupStride =
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
          lock: false,
        };
      }

      // debounce histogram calls
      const nextHistogram = () => {
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
          histogramObj.promise.then((value) => {
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
        this.z,
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
        : this.layers.find((layer) => layer.id === layerId);
  }

  get getConfigurationLayerFromId() {
    return (layerId: string) =>
      this.configuration?.layers.find((layer) => layer.id === layerId);
  }

  get getLayerIndexFromId() {
    return (layerId: string) => {
      const index = this.configuration?.layers.findIndex(
        (layer) => layer.id === layerId,
      );
      if (index === undefined || index < 0) {
        return null;
      }
      return index;
    };
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
    const snapshots = (this.configuration.snapshots || []).filter(
      (d) => d.name !== snapshot.name,
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
    const snapshots = (this.configuration.snapshots || []).filter(
      (d) => d.name !== name,
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
        sync: false,
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

  @Action
  async scheduleHistogramCache(datasetId: string) {
    return this.api.scheduleHistogramCache(datasetId);
  }
}

const main = getModule(Main);

export default main;
