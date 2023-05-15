<template>
  <v-expansion-panels
    class="d-block mt-2"
    multiple
    accordion
    v-mousetrap="mousetrapGlobalToggles"
  >
    <v-expansion-panel>
      <div class="pr-8">
        <v-row dense>
          <v-col cols="7">
            <draggable
              v-model="dropZoneArray"
              group="indexedLayer"
              class="ma-1 pa-1 drop"
              :class="{ dragging: isDragging, 'not-dragging': !isDragging }"
            >
              Create group
            </draggable>
          </v-col>
          <v-col
            class="text-caption header-col"
            title="hotkey Z"
            v-show="displayZ"
          >
            Z max-merge
          </v-col>
          <v-col class="text-caption header-col" title="hotkey 0">
            Channel on/off
          </v-col>
        </v-row>
      </div>
    </v-expansion-panel>
    <v-divider />
    <draggable
      v-model="groupsArrayWithSpacers"
      :animation="200"
      :fallbackOnBody="true"
      :swapThreshold="0.65"
    >
      <transition-group type="transition">
        <template v-for="[groupId, indexedLayers] in groupsArrayWithSpacers">
          <display-layer-group
            v-if="indexedLayers"
            :key="groupId"
            group="indexedLayer"
            :single-layer="groupId.startsWith(singleLayerPrefix)"
            :indexed-layers="indexedLayers"
            @start="isDragging = true"
            @end="isDragging = false"
            @update="changeLayersInGroup($event, groupId)"
          />
          <draggable
            v-else
            :value="[]"
            :key="groupId"
            @input="spacerUpdate($event, groupId)"
            group="indexedLayer"
            class="group-spacer"
          />
        </template>
      </transition-group>
    </draggable>
    <v-expansion-panel readonly class="add-layer">
      <v-btn @click="addLayer" icon>
        <v-icon>mdi-plus-circle</v-icon>
      </v-btn>
    </v-expansion-panel>
  </v-expansion-panels>
</template>
<script lang="ts">
import { IDisplayLayer, IIndexedLayer } from "@/store/model";
import { v4 as uuidv4 } from "uuid";
import { Vue, Component } from "vue-property-decorator";
import DisplayLayerGroup from "./DisplayLayerGroup.vue";
import draggable from "vuedraggable";
import store from "@/store";

const singleLayerPrefix = "single-layer-group_";
const spacerPrefix = "spacer_";

function groupIdFromLayer(layer: IDisplayLayer) {
  return layer.layerGroup ?? singleLayerPrefix + layer.id;
}

function spacerIdBeforeGroup(groupIdAfterSpacer?: string) {
  return groupIdAfterSpacer ? spacerPrefix + groupIdAfterSpacer : spacerPrefix;
}

function groupIdAfterSpacer(spacerId: string) {
  if (spacerId === spacerPrefix) {
    return null;
  }
  return spacerId.slice(spacerPrefix.length);
}

@Component({
  components: {
    DisplayLayerGroup,
    draggable
  }
})
export default class DisplayLayers extends Vue {
  readonly store = store;
  readonly singleLayerPrefix = singleLayerPrefix;

  isDragging: boolean = false;

  get displayZ() {
    return this.store.z;
  }

  // Maps a layer groupId to a list of layers
  get groupsMap() {
    // A Map remembers order of insertion
    const groups: Map<string, IIndexedLayer[]> = new Map();
    if (!this.store.configuration) {
      return groups;
    }
    const configurationLayers = this.store.configuration.layers;
    const layers = this.store.layers;
    for (let layerIdx = 0; layerIdx < layers.length; ++layerIdx) {
      const layer = layers[layerIdx];
      const configurationLayer = configurationLayers[layerIdx];
      const groupId = groupIdFromLayer(layer);
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push({ layer, configurationLayer, layerIdx });
    }
    return groups;
  }

  // A list of tuples [groupId | spacerId, layers | null]
  get groupsArrayWithSpacers() {
    const groupsArray = Array.from(this.groupsMap.entries());
    const withSpacers: [string, IIndexedLayer[] | null][] = [];
    groupsArray.forEach(e =>
      withSpacers.push([spacerIdBeforeGroup(e[0]), null], e)
    );
    withSpacers.push([spacerIdBeforeGroup(), null]);
    return withSpacers;
  }

  // Changes the order of the groups
  set groupsArrayWithSpacers(value) {
    this.changeGroupsInWrapper(value);
  }

  get dropZoneArray() {
    return [];
  }

  // Create a group from the layer dropped in the zone
  set dropZoneArray(value: IIndexedLayer[]) {
    if (value.length <= 0) {
      return;
    }
    this.createGroupFromLayer(value[0]);
  }

  // Change the order of the groups
  changeGroupsInWrapper(groups: [string, IIndexedLayer[] | null][]) {
    this.isDragging = false;
    // Groups have changed position
    const newConfigurationLayers = [];
    for (const [_, indexedLayers] of groups) {
      if (indexedLayers) {
        for (const { configurationLayer } of indexedLayers) {
          newConfigurationLayers.push(configurationLayer);
        }
      }
    }
    this.store.setConfigurationLayers(newConfigurationLayers);
  }

  // The user dropped a layer in the spacer between two groups
  spacerUpdate(indexedLayers: IIndexedLayer[], spacerId: string) {
    this.isDragging = false;
    if (!this.store.configuration || indexedLayers.length !== 1) {
      return;
    }
    const configurationLayers = this.store.configuration.layers;
    const layerToMove = indexedLayers[0].layer;
    const groupId = groupIdAfterSpacer(spacerId);

    // Find current position of item to move
    const currentPosition = configurationLayers.findIndex(
      layer => layer.id === layerToMove.id
    );
    if (currentPosition < 0) {
      return;
    }

    // Find position of insertion
    let insertPosition = groupId
      ? configurationLayers.findIndex(
          layer => groupIdFromLayer(layer) === groupId
        )
      : configurationLayers.length;
    if (insertPosition < 0) {
      return;
    }

    // Move the element
    if (
      currentPosition !== insertPosition &&
      currentPosition !== insertPosition - 1
    ) {
      const layer = configurationLayers[currentPosition];
      if (currentPosition < insertPosition) {
        for (let i = currentPosition; i < insertPosition - 1; i++) {
          configurationLayers[i] = configurationLayers[i + 1];
        }
        configurationLayers[insertPosition - 1] = layer;
      } else {
        for (let i = currentPosition; i > insertPosition; i--) {
          configurationLayers[i] = configurationLayers[i - 1];
        }
        configurationLayers[insertPosition] = layer;
      }
    }
    this.store.setConfigurationLayers(configurationLayers);
  }

  // The user moved a layer within a group
  changeLayersInGroup(indexedLayers: IIndexedLayer[], groupId: string) {
    this.isDragging = false;
    // Layers of this group have changed (layer added, removed or changed position)
    if (!this.store.configuration) {
      return;
    }
    const configurationLayers = this.store.configuration.layers;

    // Get the id of all layers in the group
    const layerIdsInGroup = new Set();
    for (const { configurationLayer } of indexedLayers) {
      layerIdsInGroup.add(configurationLayer.id);
    }

    const layerGroup = groupId.startsWith(this.singleLayerPrefix)
      ? null
      : groupId;

    // Create 3 groups of layers: before group, in group, after group
    // Also set the layerGroup attribute of each layer
    const layersBeforeGroup: IDisplayLayer[] = [];
    const layersAfterGroup: IDisplayLayer[] = [];
    const layersInGroup: Map<string, IDisplayLayer> = new Map();
    let isLayerBeforeGroup = true;
    for (const currentLayer of configurationLayers) {
      const currentGroupId = groupIdFromLayer(currentLayer);
      const wasInGroup = currentGroupId === groupId;
      const isInGroup = layerIdsInGroup.has(currentLayer.id);
      if (wasInGroup && !isInGroup) {
        // Removed from the group
        currentLayer.layerGroup = null;
      } else if (!wasInGroup && isInGroup) {
        // Added to the group
        currentLayer.layerGroup = layerGroup;
      }
      if (isInGroup) {
        layersInGroup.set(currentLayer.id, currentLayer);
      } else {
        if (isLayerBeforeGroup) {
          layersBeforeGroup.push(currentLayer);
        } else {
          layersAfterGroup.push(currentLayer);
        }
      }
      if (wasInGroup) {
        isLayerBeforeGroup = false;
      }
    }

    // Sort layers in group as in indexedLayers parameter
    const orderedLayersInGroup = [];
    for (const { configurationLayer } of indexedLayers) {
      const layerId = configurationLayer.id;
      const newLayer = layersInGroup.get(layerId);
      if (newLayer) {
        orderedLayersInGroup.push(newLayer);
      }
    }

    // Set the new configuration layers
    this.store.setConfigurationLayers([
      ...layersBeforeGroup,
      ...orderedLayersInGroup,
      ...layersAfterGroup
    ]);
  }

  createGroupFromLayer(indexedLayer: IIndexedLayer) {
    const newGroupId = uuidv4();
    this.store.changeLayer({
      index: indexedLayer.layerIdx,
      delta: {
        layerGroup: newGroupId
      }
    });
  }

  addLayer() {
    this.store.addLayer();
  }

  // Mousetrap bindings
  mousetrapGlobalToggles = [
    {
      bind: "z",
      handler: this.store.toggleGlobalZMaxMerge
    },
    {
      bind: "0",
      handler: this.store.toggleGlobalLayerVisibility
    }
  ];
}
</script>

<style lang="scss" scoped>
.add-layer {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-col {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.drop {
  border: dashed;
  text-align: center;
}

.dragging {
  opacity: 0.5;
}

.not-dragging {
  opacity: 0;
}

.group-spacer {
  padding-bottom: 10px;
  margin-bottom: -10px;
}
</style>
