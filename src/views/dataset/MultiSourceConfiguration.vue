<template>
  <v-container>
    <v-subheader>Variables</v-subheader>
    <v-data-table :headers="headers" :items="items" item-key="key">
    </v-data-table>
    <v-subheader>Assignments</v-subheader>
    <v-container>
      <v-row
        v-for="[dimension, dimensionName] in Object.entries(dimensionNames)"
        :key="dimension"
      >
        <v-col>{{ dimensionName }} ({{ dimension }})</v-col>
        <v-col>
          <v-combobox
            v-model="assignments[dimension]"
            :items="assignmentItems"
            :search-input.sync="searchInput"
            item-text="text"
            item-value="value"
            hide-selected
            hide-details
            dense
            :disabled="
              assignments[dimension] &&
                assignments[dimension].value.source === 'file'
            "
          >
            <template v-slot:selection="{ item }">
              {{ item.text }}
            </template>
          </v-combobox>
        </v-col>
        <v-col>
          <v-btn
            :disabled="
              !assignments[dimension] ||
                (assignments[dimension] &&
                  assignments[dimension].value.source === 'file')
            "
            @click="assignments[dimension] = null"
            >Clear</v-btn
          >
        </v-col>
      </v-row>
    </v-container>
    <v-btn @click="generateJson" :disabled="!canSubmit()">SUBMIT</v-btn>
    <v-btn
      @click="resetDimensionsToDefault"
      class="ml-4"
      :disabled="areDimensionsSetToDefault()"
      >Reset to defaults</v-btn
    >
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";

import { collectFilenameMetadata2 } from "@/utils/parsing";
import { IGirderItem } from "@/girder";

enum Sources {
  File = "file",
  Filename = "filename",
  Images = "images"
}

interface IDimension {
  id: string; // Guessed dimension
  size: number; // Number of elements on this dimension
  name: string; // Displayed name
  source: Sources; // Source of the dimension
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

  // Create a short string describing the array with some elements from the array
  // For example: ["foo", "bar", "foobar", "barfoo"] => "foo, bar, foobar..."
  arrayToExampleValues(arr: string[]) {
    let values = arr.slice(0, 3).join(", ");
    if (arr.length > 3) {
      values = String.prototype.concat(values, "...");
    }
    return values;
  }

  get items() {
    return this.dimensions
      .filter(dim => dim.size > 0)
      .map((dim: IDimension) => {
        let values = "";
        switch (dim.source) {
          case Sources.Filename:
            if (this.collectedMetadata) {
              const metadataID = this.dimensionTometadataId(dim.id);
              const exampleValues = this.collectedMetadata.metadata[metadataID];
              values = this.arrayToExampleValues(exampleValues);
            }
            break;
          case Sources.File:
            values = "Metadata";
            break;
        }
        return {
          ...dim,
          values,
          key: `${dim.id}_${dim.source}`
        };
      });
  }

  dimensions: IDimension[] = [];

  headers = [
    {
      text: "Variable",
      value: "name"
    },
    {
      text: "Values",
      value: "values"
    },
    {
      text: "Guess",
      value: "id"
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

  dimensionNames = { XY: "Positions", Z: "Z", T: "Time", C: "Channels" };

  dimensionTometadataId(id: string) {
    return id === "C" ? "chan" : id.toLowerCase();
  }

  dimensionToAssignmentItem(dimension: IDimension | null): IAssignment | null {
    if (!dimension) {
      return null;
    }
    return {
      text: dimension.name,
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
  strides: { [dimension: string]: number } = {};
  areStridesSetFromFile: boolean = false;

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
  filenameVariableCount = 0;
  fileVariableCount = 0;
  imageVariableCount = 0;

  addSizeToDimension(
    id: string,
    size: number,
    source: Sources,
    name: string | null = null
  ) {
    if (size === 0) {
      return;
    }
    const dim = this.dimensions.find(
      dimension => dimension.id === id && dimension.source === source
    );
    if (dim) {
      dim.size = dim.size + size;
    } else {
      let computedName = name;
      if (!computedName) {
        computedName = "";
        switch (source) {
          case Sources.Filename:
            computedName = `Filename variable ${++this.filenameVariableCount}`;
            break;
          case Sources.File:
            computedName = `Metadata ${++this.fileVariableCount} (${
              this.dimensionNames[id]
            }) `;
            break;
          case Sources.Images:
            computedName = `Image variable ${++this.imageVariableCount}`;
            break;
        }
      }
      this.dimensions = [
        ...this.dimensions,
        { id, size, name: computedName, source }
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
        ({ id, source, size }) =>
          size > 0 && source === Sources.File && id === assignment
      ) ||
        this.dimensions.find(({ id, size }) => size > 0 && id === assignment) ||
        null
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
    tiles.forEach(tile => {
      const frames: number = tile.frames?.length || 1;
      this.maxFramesPerItem = Math.max(this.maxFramesPerItem, frames);
      if (tile.IndexStride) {
        Object.keys(this.dimensionNames).forEach((dimension: string) => {
          const stride = tile.IndexStride[`Index${dimension}`];
          if (stride && stride > 0) {
            this.strides[dimension.toLowerCase()] = stride;
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
      } else {
        this.dimensions = [
          ...this.dimensions,
          {
            id: "Z",
            size: this.maxFramesPerItem,
            name: "Frames per image variable",
            source: Sources.Images
          }
        ];
      }
      if (tile.channels) {
        tile.channels
          .filter((channel: string) => !channels.includes(channel))
          .forEach((channel: string) => channels.push(channel));
      }
    });

    if (channels.length > 0) {
      const channelName = `Metadata (Channel): ${this.arrayToExampleValues(
        channels
      )}`;
      this.addSizeToDimension("C", channels.length, Sources.File, channelName);
    }

    this.channels = channels.length > 0 ? channels : metadata.chan;

    if (!this.channels.length) {
      this.channels = ["Default"];
    }

    this.resetDimensionsToDefault();
  }

  resetDimensionsToDefault() {
    Object.keys(this.dimensionNames).forEach(
      dim => (this.assignments[dim] = this.getDefaultAssignmentItem(dim))
    );
  }

  areDimensionsSetToDefault() {
    return Object.keys(this.dimensionNames).every(
      dim =>
        this.getDefaultAssignmentItem(dim)?.value ===
        this.assignments[dim]?.value
    );
  }

  canSubmit() {
    const filledAssignments = Object.entries(this.assignments).filter(
      ([_, assignment]) => assignment !== null
    ).length;
    return filledAssignments >= this.items.length || filledAssignments >= 4;
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

    const framesAsAxes: { [dim: string]: number } = this.strides;

    const description = {
      channels: this.channels,
      sources: this.girderItems.map((item: IGirderItem) => {
        const source: any = { path: item.name };
        Object.entries(this.assignments)
          .filter(([_, assignment]) => !!assignment)
          .forEach(([assignmentId, assignment]) => {
            let value = [dimCount[assignmentId]];

            switch (assignment?.value.source) {
              case Sources.Filename:
                let id = assignment?.value.id;
                if (id && filesInfo) {
                  id = this.dimensionTometadataId(id);
                  value = filesInfo[item.name][id];
                }
                break;
              case Sources.File:
                dimCount[assignmentId] += assignment?.value.size || 0;
                break;
              case Sources.Images:
                framesAsAxes[assignmentId.toLowerCase()] = 1;
                break;
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
