<template>
  <v-container>
    <v-menu
      offset-x
      v-model="isMainMenuVisible"
      :close-on-content-click="false"
      :min-width="'min-content'"
    >
      <template v-slot:activator="{ on, attrs }">
        <v-text-field
          readonly
          label="Tool type"
          v-bind="attrs"
          v-on="on"
          :value="selectionLabel"
        />
      </template>
      <v-list dense class="floating-list pa-0 overflow-y-auto">
        <div
          v-for="(template, templateIdx) in templates"
          :key="template.type"
          class="px-4 py-2"
        >
          <div class="pa-2">
            {{ template.name }}
          </div>
          <v-list-item
            v-for="item in submenus[templateIdx].items"
            :key="item.key"
            @click="() => selectSubmenuItem(submenus[templateIdx], item)"
            class="pa-0 pl-8"
          >
            {{ item.text }}
          </v-list-item>
        </div>
      </v-list>
    </v-menu>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import toolsStore from "@/store/tool";
import propertiesStore from "@/store/properties";
import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";

const defaultValues = {
  name: "New Tool",
  description: ""
};

@Component({
  components: {
    ToolConfiguration
  }
})
export default class ToolTypeSelection extends Vue {
  readonly toolStore = toolsStore;
  readonly propertyStore = propertiesStore;

  @Prop()
  private value: any;

  computedTemplate: any = null;
  defaultToolValues: any = { ...defaultValues };

  isMainMenuVisible = false;
  selectionLabel: string | null = null;

  get submenus() {
    return this.templates.map(template => {
      // For each template, an interface element is used as submenu
      const submenuInterfaceIdx = template.interface.findIndex(
        (elem: any) => elem.isSubmenu
      );
      const submenuInterface = template.interface[submenuInterfaceIdx];
      let items: {
        text: string;
        value: any;
        [key: string]: any;
      }[] = [];
      switch (submenuInterface?.type) {
        case "select":
          items = submenuInterface.meta.items;
          break;
        case "annotation":
          items = this.toolStore.availableShapes;
          break;
        case "dockerImage":
          items = this.propertyStore.workerImageList.map(image => ({
            text: image,
            value: { image }
          }));
          break;
        default:
          items.push({ text: "No Submenu", value: "defaultSubmenu" });
          break;
      }
      const keydItems: {
        text: string;
        key: string;
        value: any;
        [key: string]: any;
      }[] = items.map(item => ({
        ...item,
        key: template.type + "#" + item.value
      }));
      return {
        template,
        submenuInterface,
        submenuInterfaceIdx,
        items: keydItems
      };
    });
  }

  // The new template and the default tool values are computed
  // depending on the type of the interface element used as submenu
  selectSubmenuItem(
    submenu: typeof this.submenus[0],
    item?: typeof submenu.items[0]
  ) {
    const { template, submenuInterface, submenuInterfaceIdx } = submenu;
    this.isMainMenuVisible = false;

    if (!item) {
      this.selectionLabel = template.name;
      this.computedTemplate = template;
      this.defaultToolValues = { ...defaultValues };
      return;
    }

    let computedTemplate = template;
    let defaultToolValues: any = { ...defaultValues };

    this.selectionLabel = template.name + " / " + item.text;
    // template references to the store template
    // Shallow copy some parts of it to avoid overwriting
    switch (submenuInterface.type) {
      case "select":
      case "dockerImage":
        // Remove the interface used as submenu
        computedTemplate = {
          ...template,
          interface: [
            ...template.interface.slice(0, submenuInterfaceIdx),
            ...(item.meta?.interface ? item.meta.interface : []),
            ...template.interface.slice(submenuInterfaceIdx + 1)
          ]
        };
        // Set default value from item value
        defaultToolValues[submenuInterface.id] = item.value;
        break;
      case "annotation":
        // Keep the annotation interface but hide shape and define default shape
        computedTemplate = {
          ...template,
          interface: template.interface.slice()
        };
        const computedAnnotationInterface = {
          ...template.interface[submenuInterfaceIdx]
        };
        if (!computedAnnotationInterface.meta) {
          computedAnnotationInterface.meta = {};
        }
        computedAnnotationInterface.meta.hideShape = true;
        computedAnnotationInterface.meta.defaultShape = item.value;
        computedTemplate.interface[
          submenuInterfaceIdx
        ] = computedAnnotationInterface;
        break;
      default:
        break;
    }
    this.computedTemplate = computedTemplate;
    this.defaultToolValues = defaultToolValues;
  }

  @Watch("computedTemplate")
  @Watch("defaultToolValues")
  handleChange() {
    this.$emit("input", {
      template: this.computedTemplate,
      defaultValues: this.defaultToolValues
    });
    if (!this.computedTemplate) {
      this.selectionLabel = null;
    }
  }

  mounted() {
    this.initialize();
  }

  get templates() {
    return this.toolStore.toolTemplateList;
  }

  @Watch("templates")
  @Watch("value")
  initialize() {
    // Set initial value
    if (!this.value && this.templates.length) {
      this.computedTemplate = null;
      this.defaultToolValues = { ...defaultValues };
      this.handleChange();
    }
  }
}
</script>

<style lang="scss" scoped>
.floating-list {
  display: flex;
  flex-direction: column;
  flex-shrink: 1;
  max-height: 90vh;
  min-width: 0;
}
</style>
