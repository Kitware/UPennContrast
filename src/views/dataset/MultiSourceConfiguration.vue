<template>
  <v-container>
    <v-subheader>Variables</v-subheader>
    <v-data-table :headers="headers" :items="items" item-key="key">
    </v-data-table>
    <v-subheader>Assignments</v-subheader>
    <v-container>
      <v-row v-for="assignment in assignmentNames" :key="assignment">
        <v-col>
          {{ assignment }}
        </v-col>
        <v-col>
          <v-combobox
            v-model="assignments[assignment]"
            :items="assignmentItems"
            :search-input.sync="searchInput"
            item-text="text"
            item-value="value"
            hide-selected
            hide-details
            dense
            :disabled="
              assignments[assignment] &&
                assignments[assignment].value.source === 'file'
            "
          >
            <template v-slot:selection="{ item }">
              {{ item.text }}
            </template>
          </v-combobox>
        </v-col>
        <v-col v-if="!areStridesSetFromFile && maxFramesPerItem > 1">
          <v-text-field
            prefix="Stride"
            :rules="[
              input => input === null || input === '' || parseInt(input) > 0
            ]"
            :disabled="
              assignments[assignment] &&
                assignments[assignment].value.source === 'file'
            "
            v-model="strides[assignment]"
            hide-details
            single-line
            type="number"
          />
        </v-col>
        <v-col>
          <v-btn
            :disabled="
              (!assignments[assignment] &&
                (typeof strides[assignment] !== 'string' ||
                  strides[assignment] === '')) ||
                (assignments[assignment] &&
                  assignments[assignment].value.source === 'file')
            "
            @click="
              assignments[assignment] = null;
              strides[assignment] = null;
            "
            >Clear</v-btn
          >
        </v-col>
      </v-row>
    </v-container>
    <v-btn @click="generateJson">SUBMIT</v-btn>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";

import { collectFilenameMetadata2 } from "@/utils/parsing";
import { IGirderItem } from "@/girder";

const Sources = {
  File: "file",
  Filename: "filename"
};

interface IDimension {
  id: string;
  size: number;
  name: string | null;
  source: string;
}

interface IAssignment {
  text: string;
  value: IDimension;
}

@Component({
  components: {}
})
export default class NewDataset extends Vue {
  readonly store = store;

  get datasetId() {
    return this.$route.params.id;
  }

  get items() {
    return this.dimensions
      .filter(dim => dim.size > 0)
      .map((dim: any) => ({ ...dim, key: `${dim.id}_${dim.source}` }));
  }

  dimensions: IDimension[] = [];

  headers = [
    {
      text: "Name",
      value: "name"
    },
    {
      text: "Source",
      value: "source"
    },
    {
      text: "Size",
      value: "size"
    }
  ];

  assignmentNames = ["XY", "Z", "T", "C"];

  dimensionToAssignmentItem(dimension: IDimension | null): IAssignment | null {
    if (!dimension) {
      return null;
    }
    return {
      text: `${dimension.source} ${dimension.name || dimension.id}`,
      value: dimension
    };
  }

  get assignmentItems() {
    const assignedDimensions = Object.entries(this.assignments)
      .map(([_, assignment]: [any, any]) => assignment?.value || null)
      .filter(assignment => !!assignment);

    const isNotAssigned = (dimension: IDimension) => {
      return !assignedDimensions.find(
        assignedDimension =>
          assignedDimension.id === dimension.id &&
          assignedDimension.source === dimension.source
      );
    };
    return this.items.filter(isNotAssigned).map(this.dimensionToAssignmentItem);
  }

  assignments: { [dimension: string]: IAssignment | null } = {
    XY: null,
    Z: null,
    T: null,
    C: null
  };
  strides: { [dimension: string]: number | string | null } = {
    XY: null,
    Z: null,
    T: null,
    C: null
  };
  areStridesSetFromFile = false;

  collectedMetadata: {
    metadata: {
      [key: string]: string[];
      t: string[];
      xy: string[];
      z: string[];
      chan: string[];
    };
    filesInfo: {
      [key: string]: { [key: string]: number[] };
    };
  } | null = null;

  searchInput: string = "";

  addSizeToDimension(
    id: string,
    size: number,
    source: string,
    name: string | null = null
  ) {
    const dim = this.dimensions.find(
      dimension => dimension.id === id && dimension.source === source
    );
    if (dim) {
      dim.size = dim.size + size;
    } else {
      this.dimensions = [
        ...this.dimensions,
        { id, size, name: name ? name : id, source }
      ];
    }
  }

  setDimensionName(id: string, source: string, name: string) {
    const dim = this.dimensions.find(
      dimension => dimension.id === id && dimension.source === source
    );
    if (dim) {
      dim.name = name;
      this.dimensions = [...this.dimensions];
    }
  }

  numberOfFrames = 0; // TODO: assume constant
  maxFramesPerItem: number = 1;

  girderItems: IGirderItem[] = [];

  getDefaultAssignmentItem(assignment: string) {
    return this.dimensionToAssignmentItem(
      this.dimensions.find(
        ({ id, source }) => source === Sources.File && id === assignment
      ) || null
    );
  }

  channels: string[] = [];

  @Watch("datasetId")
  async mounted() {
    // Get tile information
    const items = await this.store.api.getItems(this.datasetId);
    this.girderItems = items;

    //  Get info from filename
    const names = items.map(item => item.name);

    this.collectedMetadata = collectFilenameMetadata2(names);
    const { metadata } = this.collectedMetadata;
    this.addSizeToDimension("Z", metadata.z.length, Sources.Filename);
    this.addSizeToDimension("C", metadata.chan.length, Sources.Filename);
    this.addSizeToDimension("T", metadata.t.length, Sources.Filename);
    this.addSizeToDimension("XY", metadata.xy.length, Sources.Filename);

    // Get info from file
    const tiles = await Promise.all(
      items.map(item => this.store.api.getTiles(item))
    );
    this.numberOfFrames = tiles[0]?.frames?.length || tiles.length;

    const channels: string[] = [];

    this.maxFramesPerItem = 1;
    this.areStridesSetFromFile = false;
    tiles.forEach((tile: any) => {
      const frames: number = tile.frames?.length || 1;
      this.maxFramesPerItem = Math.max(this.maxFramesPerItem, frames);
      if (tile.IndexStride) {
        this.assignmentNames.forEach(dimension => {
          const stride = tile.IndexStride[`Index${dimension}`];
          if (stride && stride > 0) {
            this.strides[dimension] = stride;
            this.areStridesSetFromFile = true;
          }
        });
      }
      if (tile.IndexRange) {
        this.addSizeToDimension("Z", tile.IndexRange.IndexZ, Sources.File);
        this.addSizeToDimension("T", tile.IndexRange.IndexT, Sources.File);
        this.addSizeToDimension("XY", tile.IndexRange.IndexXY, Sources.File);
      } else if (!this.dimensions.some(dimension => dimension.size > 0)) {
        this.addSizeToDimension("Single Image", 1, Sources.Filename);
      }
      if (tile.channels) {
        tile.channels
          .filter((channel: string) => !channels.includes(channel))
          .forEach((channel: string) => channels.push(channel));
      }
    });

    if (channels.length > 0) {
      this.addSizeToDimension("C", channels.length, Sources.File);
      const channelName = `{ ${channels.join()} }`;
      this.setDimensionName("C", Sources.File, channelName);
    }

    this.channels = channels.length > 0 ? channels : metadata.chan;

    if (!this.channels.length) {
      this.channels = ["Default"];
    }

    this.assignments.Z = this.getDefaultAssignmentItem("Z");
    this.assignments.XY = this.getDefaultAssignmentItem("XY");
    this.assignments.T = this.getDefaultAssignmentItem("T");
    this.assignments.C = this.getDefaultAssignmentItem("C");
  }

  async generateJson() {
    const dimCount: any = {
      C: 0,
      Z: 0,
      XY: 0,
      T: 0
    };

    const filesInfo = this.collectedMetadata
      ? this.collectedMetadata.filesInfo
      : null;

    const framesAsAxes: { [dim: string]: number } = {};
    Object.entries(this.strides).forEach(([dimension, stride]) => {
      if (stride) {
        if (typeof stride === "string") {
          stride = parseInt(stride);
        }
        if (stride > 0) {
          framesAsAxes[dimension.toLowerCase()] = stride;
        }
      }
    });

    const description = {
      channels: this.channels,
      sources: this.girderItems.map((item: IGirderItem) => {
        const source: any = { path: item.name };
        Object.entries(this.assignments)
          .filter(([_, assignment]) => !!assignment)
          .forEach(([assignmentId, assignment]) => {
            let value = [dimCount[assignmentId]];

            if (assignment?.value.source === Sources.Filename) {
              let id = assignment?.value.id;
              if (id && filesInfo) {
                id = id === "C" ? "chan" : id;
                value = filesInfo[item.name][id.toLowerCase()];
              }
            } else {
              dimCount[assignmentId] += assignment?.value.size || 0;
            }
            source[`${assignmentId.toLowerCase()}Values`] = value;
          });
        source.framesAsAxes = framesAsAxes;
        return source;
      })
    };

    const newItemId = await this.store.addMultiSourceMetadata({
      parentId: this.datasetId,
      metadata: JSON.stringify(description)
    });
    this.$router.push({
      name: "dataset",
      params: {
        id: this.datasetId
      }
    });
  }

  // TODO: composite
}
</script>
