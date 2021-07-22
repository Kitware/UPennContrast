import { RestClient, RestClientInstance } from "@/girder";
import { IGirderSelectAble, IGirderUser } from "@/girder";
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import GirderAPI from "./GirderAPI";
import { getLayerImages } from "./images";
import {
  IDataset,
  IDatasetConfiguration,
  IDatasetConfigurationMeta,
  IDisplayLayer,
  IImage,
  IImageTile,
  IAnnotation,
  IAnnotationConnection,
  newLayer,
  IToolConfiguration
} from "./model";
import persister from "./Persister";
import store from "./root";
import sync from "./sync";
import { MAX_NUMBER_OF_RECENT_CONFIGURATIONS } from "./constants";

export { default as store } from "./root";

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  girderUrl = persister.get("girderUrl", "http://localhost:8080");
  girderRest = new RestClient({
    apiRoot: `${this.girderUrl}/api/v1`
  });
  api = new GirderAPI(this.girderRest);
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
  layerMode: "single" | "multiple" = "multiple";
  annotationMode: string | null = null;
  annotationModeList: any[] = [];

  annotations: IAnnotation[] = [];
  annotationConnections: IAnnotationConnection[] = [];

  selectedToolId: string | null = null;
  toolTemplateList: any[] = [];

  tools: IToolConfiguration[] = [];

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

  @Mutation
  public addTools({ tools }: { tools: IToolConfiguration[] }) {
    this.tools = [
      // If duplicates are found, make sure we only keep the latest ones
      ...this.tools.filter(
        (existingTool: IToolConfiguration) =>
          !tools.find(newTool => existingTool.id === newTool.id)
      ),
      ...tools
    ];
  }

  @Mutation
  public addToolIdsToCurrentToolset({ ids }: { ids: string[] }) {
    if (this.configuration?.toolset) {
      this.configuration.toolset.toolIds = [
        ...this.configuration?.toolset.toolIds,
        ...ids
      ];
    }
  }

  @Mutation
  public removeToolIdFromCurrentToolset({ id }: { id: string }) {
    if (this.configuration?.toolset) {
      this.configuration.toolset.toolIds = this.configuration.toolset.toolIds.filter(
        idToFilter => id !== idToFilter
      );
    }
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
    this.api = new GirderAPI(this.girderRest);
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
    const restClient = new RestClient({
      apiRoot: `${domain}/api/v1`
    });

    try {
      sync.setLoading(true);
      await restClient.login(username, password);
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
      girderRest: restClient
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

  // We don't need to fetch all tools unless the user wants to add new ones
  // This only fetches the tools in the current toolset
  @Action
  async refreshToolsInCurrentToolset() {
    if (this.configuration?.toolset) {
      this.configuration.toolset.toolIds.forEach(toolId => {
        this.api
          .getTool(toolId)
          .then(tool => {
            this.addTools({ tools: [tool] });
          })
          .catch(e => {
            console.error("Could not fetch tool: ", e);
          });
      });
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

  @Action
  async createTool({
    name,
    description
  }: {
    name: string;
    description: string;
  }) {
    try {
      sync.setSaving(true);
      const tool = await this.api.createTool(name, description);
      this.addTools({ tools: [tool] });
      sync.setSaving(false);
      return tool;
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
    }
  }

  @Mutation
  setSelectedToolId(id: string | null) {
    this.selectedToolId = id;
  }

  @Mutation
  setAnnotationMode(mode: string | null) {
    this.annotationMode = mode;
  }

  @Mutation
  setAnnotationModeList(modeList: any[]) {
    this.annotationModeList = modeList;
  }

  @Mutation
  setToolTemplateList(templateList: any[]) {
    this.toolTemplateList = templateList;
  }

  @Action
  async updateTool(tool: IToolConfiguration) {
    if (!tool) {
      return;
    }
    sync.setSaving(true);
    try {
      await this.api.updateTool(tool);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Action
  async fetchAvailableTools() {
    try {
      const tools = await this.api.getAllTools();
      this.addTools({ tools });
    } catch (error) {
      console.error("Unable to fetch a list of available tools", error);
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
  // Very inefficient, but will work for now
  async syncAnnotations() {
    if (!this.dataset) {
      return;
    }
    sync.setSaving(true);
    try {
      await this.api.setAnnotationsToDataset(
        this.annotations,
        this.annotationConnections,
        this.dataset
      );
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
  private setLayerModeImpl(mode: "multiple" | "single") {
    this.layerMode = mode;
  }

  @Mutation
  private verifySingleLayerMode() {
    if (!this.configuration) {
      return;
    }
    const visible = this.configuration.view.layers.reduce(
      (acc, l) => acc + (l.visible ? 1 : 0),
      0
    );
    if (visible > 1) {
      let first = true;
      this.configuration.view.layers.forEach(l => {
        if (l.visible) {
          l.visible = first;
          first = false;
        }
      });
    }
  }

  @Action
  async setLayerMode(mode: "multiple" | "single") {
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
    Object.assign(this.configuration.view.layers[index], delta);
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
          // maxTextures: 8,
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
      const images = getLayerImages(
        layer,
        this.dataset,
        this.time,
        this.xy,
        this.z
      );
      if (!layer._histogram) {
        layer._histogram = {
          promise: Promise.resolve(),
          last: true,
          next: null,
          images: null
        };
      }

      // debounce histogram calls
      let nextHistogram = () => {
        if (layer._histogram.next) {
          const images = layer._histogram.next;
          layer._histogram.last = null;
          layer._histogram.promise = this.api.getLayerHistogram(images);
          layer._histogram.next = null;
          layer._histogram.images = images;
          layer._histogram.promise.then((value: any) => {
            layer._histogram.last = value;
            return null;
          });
          layer._histogram.promise.finally(nextHistogram);
        }
        return null;
      };
      if (images !== layer._histogram.images) {
        layer._histogram.next = images;
        if (layer._histogram.last) {
          nextHistogram();
        }
      }
      return layer._histogram.promise;
    };
  }

  @Mutation
  public addAnnotation(value: IAnnotation) {
    this.annotations = [...this.annotations, value];
  }

  @Mutation
  public addConnection(value: IAnnotationConnection) {
    this.annotationConnections = [...this.annotationConnections, value];
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
}

const main = getModule(Main);

export default main;
