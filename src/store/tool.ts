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

@Module({ dynamic: true, store, name: "tool" })
export class Tools extends VuexModule {
  // User selected tool in the toolset list
  selectedToolId: string | null = null;
  // List of available tool templates for tool creation interface
  toolTemplateList: any[] = [];

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
    return main.configuration?.tools || [];
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
      sync.setSaving(false);
      return tool;
    } catch (error) {
      sync.setSaving(error);
    }
    return null;
  }
}

export default getModule(Tools);
