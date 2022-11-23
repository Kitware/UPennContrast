import {
  RestClient,
  RestClientInstance,
  IGirderFolder,
  IGirderItem
} from "@/girder";
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
  AnnotationSelectionTypes
} from "./model";

import persister from "./Persister";
import store from "./root";
import sync from "./sync";
import { MAX_NUMBER_OF_RECENT_CONFIGURATIONS } from "./constants";
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
  readonly recentConfigurations: IDatasetConfigurationMeta[] = persister.get(
    "recentConfigurations",
    []
  );

  xy: number = 0;
  z: number = 0;
  time: number = 0;
  layerMode: "single" | "multiple" | "unroll" = "multiple";

  drawAnnotations: boolean = true;
  filteredDraw: boolean = false;
  drawActive: boolean = false;
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
  public setDrawActive(value: boolean) {
    this.drawActive = value;
  }

  @Mutation
  public setDrawAnnotationConnections(value: boolean) {
    this.drawAnnotationConnections = value;
  }

  @Mutation
  protected loggedIn({
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
  @Mutation
  protected setConfiguration({
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

    // persist list

    // remove old
    const index = this.recentConfigurations.findIndex(d => d.id === data.id);
    if (index >= 0) {
      this.recentConfigurations.splice(index, 1);
    }
    this.recentConfigurations.unshift({
      id: data.id,
      name: data.name,
      description: data.description,
      datasetId: this.selectedDatasetId!,
      datasetName: this.dataset?.name || "Unknown"
    });
    if (
      this.recentConfigurations.length > MAX_NUMBER_OF_RECENT_CONFIGURATIONS
    ) {
      this.recentConfigurations.splice(
        MAX_NUMBER_OF_RECENT_CONFIGURATIONS,
        this.recentConfigurations.length - MAX_NUMBER_OF_RECENT_CONFIGURATIONS
      );
    }
    persister.set("recentConfigurations", this.recentConfigurations);
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

  @Action
  private async fetchRecentConfigurations() {
    const confs = await this.api.getRecentConfigurations();
    let curlen = this.recentConfigurations.length;
    for (let i = 0; i < 5 - curlen; i += 1) {
      const folder = await this.api.getFolder(confs[i].folderId);
      this.recentConfigurations.unshift({
        id: confs[i]._id,
        name: confs[i].name,
        description: confs[i].description,
        datasetId: confs[i].folderId!,
        datasetName: folder.name || "Unknown"
      });
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
        this.loggedIn({
          girderUrl: this.girderUrl,
          girderRest: this.girderRest
        });
      }
      await this.initFromUrl();
      sync.setLoading(false);
      if (this.recentConfigurations.length < 5) {
        await this.fetchRecentConfigurations();
      }
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

    this.loggedIn({
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
      const r = await this.api.getDatasetConfiguration(id);
      this.setConfiguration({ id, data: r });
      sync.setLoading(false);
    } catch (error) {
      sync.setLoading(error);
    }
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
    try {
      sync.setSaving(true);
      const config = await this.api.createConfiguration(
        name,
        description,
        this.dataset!
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
    // remove old
    const index = this.recentConfigurations.findIndex(
      d => d.id === configuration.id
    );
    if (index >= 0) {
      this.recentConfigurations.splice(index, 1);
      persister.set("recentConfigurations", this.recentConfigurations);
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
      await this.api.uploadJSONFile("multi-source2.json", parentId, metadata)
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
      const config = await this.api.deleteConfiguration(configuration);
      this.deleteConfigurationImpl(configuration);
      sync.setSaving(false);
      return config;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
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

    // remove all configurations
    const toDelete: number[] = [];
    this.recentConfigurations.forEach((d, i) => {
      if (d.datasetId === dataset.id) {
        toDelete.push(i);
      }
    });
    if (toDelete.length > 0) {
      // splice in reverse order
      toDelete.reverse().forEach(i => this.recentConfigurations.splice(i, 1));
      persister.set("recentConfigurations", this.recentConfigurations);
    }
  }

  @Action
  async deleteDataset(dataset: IDataset) {
    try {
      sync.setSaving(true);
      const config = await this.api.deleteDataset(dataset);
      this.deleteDatasetImpl(dataset);
      sync.setSaving(false);
      return config;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
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
    this.configuration!.view.layers.push(layer);
  }

  @Mutation
  private toggleLayer(index: number) {
    if (!this.configuration) {
      return;
    }
    const layers = this.configuration.view.layers;
    switch (this.layerMode) {
      case "single":
        layers.forEach((l, i) => (l.visible = i === index));
        break;
      case "multiple":
        layers[index].visible = !layers[index].visible;
        break;
      case "unroll":
        layers[index].visible = !layers[index].visible;
        break;
    }
  }

  @Action
  async syncConfiguration() {
    if (!this.configuration) {
      return;
    }
    sync.setSaving(true);
    try {
      await this.api.updateConfiguration(this.configuration);
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
    this.pushLayer(newLayer(this.dataset, this.configuration.view.layers));
    await this.syncConfiguration();
  }

  @Mutation
  private setLayerModeImpl(mode: "multiple" | "single" | "unroll") {
    this.layerMode = mode;
  }

  @Mutation
  private verifySingleLayerMode() {
    if (!this.configuration) {
      return;
    }
    let first = true;
    this.configuration.view.layers.forEach(l => {
      if (l.visible) {
        if (!first) {
          l.visible = false;
        }
        first = false;
      }
    });
    if (first && this.configuration.view.layers.length) {
      this.configuration.view.layers[0].visible = true;
    }
  }

  @Action
  async setLayerMode(mode: "multiple" | "single" | "unroll") {
    this.setLayerModeImpl(mode);

    if (mode === "single") {
      this.verifySingleLayerMode();
      await this.syncConfiguration();
    }
  }

  @Action
  async handleHotkey(hotKey: number) {
    if (
      !this.dataset ||
      !this.configuration ||
      hotKey < 1 ||
      hotKey > this.configuration.view.layers.length
    ) {
      return;
    }
    if (
      /^(input|textarea|select)$/.test(
        (document!.activeElement!.tagName || "").toLowerCase()
      )
    ) {
      return;
    }
    this.toggleLayer(hotKey - 1);
    await this.syncConfiguration();
  }

  @Action
  async toggleLayerVisibility(layerIndex: number) {
    if (
      !this.dataset ||
      !this.configuration ||
      layerIndex < 0 ||
      layerIndex >= this.configuration.view.layers.length
    ) {
      return;
    }
    this.toggleLayer(layerIndex);
    await this.syncConfiguration();
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
      index >= this.configuration.view.layers.length
    ) {
      return;
    }
    Vue.set(
      this.configuration.view.layers,
      index,
      Object.assign({}, this.configuration.view.layers[index], delta)
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
      await this.syncConfiguration();
    }
  }

  @Mutation
  private removeLayerImpl(index: number) {
    if (
      !this.configuration ||
      index < 0 ||
      index >= this.configuration.view.layers.length
    ) {
      return;
    }
    this.configuration.view.layers.splice(index, 1);
  }

  @Action
  async removeLayer(index: number) {
    this.removeLayerImpl(index);
    await this.syncConfiguration();
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
      const layers = this.configuration.view.layers;
      layers.forEach(layer => {
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

  get layerStackImages(): any {
    if (!this.dataset || !this.configuration || !this.api.histogramsLoaded) {
      return [];
    }
    const layers = this.configuration.view.layers;

    return layers.map(layer => {
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
      const results: { [key: string]: any } = {
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
            histogramObj.nextImages = null;
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
    return (layerId: string) =>
      this.configuration?.view.layers.find(layer => layer.id === layerId);
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
    await this.api.updateSnapshots(this.configuration);
  }

  @Action
  async addSnapshot(snapshot: { [key: string]: any }) {
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
  async loadSnapshot(name: string) {
    if (!this.configuration || !this.dataset) {
      return {};
    }
    let snapshots = (this.configuration.snapshots || []).filter(
      d => d.name == name
    );
    if (!snapshots.length) {
      return {};
    }
    let snapshot = snapshots[0];
    while (this.configuration.view.layers.length) {
      this.removeLayerImpl(0);
    }
    snapshot.layers.forEach((sslayer: { [key: string]: any }) => {
      var layer = newLayer(this.dataset!, this.configuration!.view.layers!);
      Object.assign(layer, sslayer);
      this.pushLayer(layer);
    });
    this.loadSnapshotImpl(snapshot);
    await this.syncConfiguration();
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
