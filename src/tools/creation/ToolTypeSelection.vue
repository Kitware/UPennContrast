<template>
  <v-container>
    <v-select
      return-object
      label="Tool type"
      :items="submenuItems"
      v-model="selectedItem"
    />
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import propertiesStore from "@/store/properties";
import store from "@/store";
import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";

interface Item {
  text: string;
  value: any;
  key: string;
  [key: string]: any;
}

interface Submenu {
  template: any;
  submenuInterface: any;
  submenuInterfaceIdx: any;
  items: Item[];
}

interface AugmentedItem extends Item {
  submenu: Submenu;
}

@Component({
  components: {
    ToolConfiguration
  }
})
export default class ToolTypeSelection extends Vue {
  readonly propertyStore = propertiesStore;
  readonly store = store;

  @Prop()
  private value: any;

  computedTemplate: any = null;
  defaultToolValues: any = {};

  isMainMenuVisible = false;
  selectedItem: AugmentedItem | null = null;

  // Returns a list of dividers, headers and items
  // The items are submenu items augmented with a reference to their submenus
  get submenuItems() {
    return this.submenus.reduce(
      (items, submenu) => [
        ...items,
        { divider: true },
        { header: submenu.template.name },
        ...submenu.items.map(item => ({ ...item, submenu } as AugmentedItem))
      ],
      [] as (AugmentedItem | { divider: boolean } | { header: string })[]
    );
  }

  get submenus(): Submenu[] {
    return this.templates.map(template => {
      // For each template, an interface element is used as submenu
      const submenuInterfaceIdx = template.interface.findIndex(
        (elem: any) => elem.isSubmenu
      );
      const submenuInterface = template.interface[submenuInterfaceIdx] || {};
      let items: any[] = [];
      switch (submenuInterface.type) {
        case "select":
          items = submenuInterface.meta.items.map((item: any) => ({
            ...item,
            value: item
          }));
          break;
        case "annotation":
          items = this.store.availableToolShapes;
          break;
        case "dockerImage":
          for (const image in this.propertyStore.workerImageList) {
            const labels = this.propertyStore.workerImageList[image];
            if (labels.isAnnotationWorker !== undefined) {
              items.push({
                text: labels.interfaceName || image,
                value: { image }
              });
            }
          }
          break;
        default:
          items.push({
            text: template.name || "No Submenu",
            value: "defaultSubmenu"
          });
          break;
      }
      const keydItems: Item[] = items.map((item, itemIdx) => ({
        ...item,
        key: template.type + "#" + itemIdx
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
  @Watch("selectedItem")
  selectSubmenuItem() {
    if (!this.selectedItem) {
      this.reset();
      return;
    }
    const submenu = this.selectedItem.submenu;
    const item = this.selectedItem;
    const { template, submenuInterface, submenuInterfaceIdx } = submenu;
    this.isMainMenuVisible = false;

    let computedTemplate = template;
    let defaultToolValues: any = {};

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

  refreshWorkers() {
    this.propertyStore.fetchWorkerImageList();
  }

  @Watch("computedTemplate")
  @Watch("defaultToolValues")
  handleChange() {
    this.$emit("input", {
      template: this.computedTemplate,
      defaultValues: this.defaultToolValues,
      selectedItem: this.selectedItem
    });
  }

  mounted() {
    this.initialize();
  }

  get templates() {
    return this.store.toolTemplateList;
  }

  @Watch("templates")
  @Watch("value")
  initialize() {
    // Set initial value
    if (!this.value && this.templates.length) {
      this.reset();
    }
  }

  reset() {
    this.selectedItem = null;
    this.computedTemplate = null;
    this.defaultToolValues = {};
    this.handleChange();
    this.refreshWorkers();
  }
}
</script>

<style lang="scss" scoped>
.floating-list {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
</style>
