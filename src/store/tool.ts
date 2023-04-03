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

import { AnnotationNames, AnnotationShape, IToolConfiguration } from "./model";

import { logWarning } from "@/utils/log";

@Module({ dynamic: true, store, name: "tool" })
export class Tools extends VuexModule {
  // User selected tool in the toolset list
  selectedToolId: string | null = null;
  // List of available tool templates for tool creation interface
  toolTemplateList: any[] = [];
  // All tools created by the current user
  userTools: IToolConfiguration[] = [];

  availableShapes: { value: string; text: string }[] = [
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

  get tools(): IToolConfiguration[] {
    return this.userTools.filter(
      (tool: IToolConfiguration) =>
        main.dataset &&
        tool.datasetId === main.dataset.id &&
        main.configuration &&
        tool.configurationId === main.configuration.id
    );
  }

  @Mutation
  public addTools({ tools }: { tools: IToolConfiguration[] }) {
    this.userTools = [
      // If duplicates are found, make sure we only keep the latest ones
      // Only keep tools for the current dataset configuration
      ...this.userTools.filter(
        (existingTool: IToolConfiguration) =>
          !tools.find(newTool => existingTool.id === newTool.id)
      ),
      ...tools
    ];
  }

  @Mutation
  public addToolsToCurrentToolset({ tools }: { tools: IToolConfiguration[] }) {
    if (main.configuration?.tools) {
      main.configuration.tools = [...main.configuration?.tools, ...tools];
    }
  }

  @Mutation
  public removeToolIdFromCurrentToolset({ id }: { id: string }) {
    if (main.configuration?.tools) {
      main.configuration.tools = main.configuration.tools.filter(
        tools => id !== tools.id
      );
    }
  }

  @Mutation
  setSelectedToolId(id: string | null) {
    this.selectedToolId = id;
  }

  get selectedTool(): IToolConfiguration | null {
    if (!this.selectedToolId) {
      return null;
    }
    const tool = this.tools.find(
      (tool: IToolConfiguration) => tool.id === this.selectedToolId
    );
    return tool || null;
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
      await main.api.updateTool(tool);
    } catch (error) {
      sync.setSaving(error);
    }
  }

  @Action
  async fetchAvailableTools() {
    try {
      const tools = await main.api.getAllTools();
      this.addTools({ tools });
    } catch (error) {
      error(`Unable to fetch a list of available tools: ${error.message}`);
    }
  }

  @Action
  async createTool({
    name,
    description
  }: {
    name: string;
    description: string;
  }) {
    if (!main.dataset || !main.configuration) {
      return null;
    }
    try {
      sync.setSaving(true);
      const tool = await main.api.createTool(
        name,
        description,
        main.dataset,
        main.configuration
      );
      this.addTools({ tools: [tool] });
      sync.setSaving(false);
      return tool;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
  }
}

export default getModule(Tools);
