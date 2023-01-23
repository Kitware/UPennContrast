<template>
  <v-container>
    <v-card class="pa-4 my-4">
      <v-subheader class="headline">Variables</v-subheader>
      <v-divider class="my-2" />
      <v-data-table :headers="headers" :items="items" item-key="key" />
    </v-card>
    <v-card class="pa-4 my-4">
      <v-subheader class="headline">Assignments</v-subheader>
      <v-divider class="my-2" />
      <v-container>
        <v-row
          v-for="[dimension, dimensionName] in Object.entries(dimensionNames)"
          :key="dimension"
        >
          <v-col cols="2" class="body-1">
            {{ dimensionName }} ({{ dimension }})
          </v-col>
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
                (assignments[dimension] &&
                  assignments[dimension].value.source === 'file') ||
                  assignmentItems.length === 0
              "
            >
              <template v-slot:selection="{ item }">
                {{ item.text }}
                <template v-if="shouldDoCompositing && dimension === 'XY'">
                  (will be composited)
                </template>
              </template>
            </v-combobox>
          </v-col>
          <v-col v-if="canDoCompositing && dimension === 'XY'">
            <v-checkbox
              dense
              label="Composite positions into single image"
              class="d-inline-flex"
              v-model="enableCompositing"
            />
          </v-col>
          <v-col cols="2" class="d-flex">
            <v-spacer />
            <v-btn
              :disabled="
                !assignments[dimension] ||
                  (assignments[dimension] &&
                    assignments[dimension].value.source === 'file')
              "
              @click="assignments[dimension] = null"
            >
              Clear
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
    <v-row>
      <v-col class="d-flex justify-end">
        <v-btn @click="generateJson" :disabled="!canSubmit()">
          Submit
        </v-btn>
        <v-btn
          @click="resetDimensionsToDefault"
          :disabled="areDimensionsSetToDefault()"
          class="ml-4"
        >
          Reset to defaults
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";

import {
  collectFilenameMetadata2,
  IVariableGuess,
  TDimensions
} from "@/utils/parsing";
import { IGirderItem } from "@/girder";
import { ITileMeta } from "@/store/GirderAPI";
import { IGeoJSPoint } from "@/store/model";

// Possible sources for variables
enum Sources {
  File = "file", // File metadata
  Filename = "filename", // Filenames parsing
  Images = "images" // All images from the items
}

interface IFileSourceData {
  [itemIdx: number]: {
    stride: number;
    range: number;
    values: string[] | null;
  };
}

interface IFilenameSourceData extends IVariableGuess {}

interface IAssignmentOption {
  id: number;
  guess: TDimensions; // Guessed dimension
  size: number; // Number of elements on this dimension
  data: IFileSourceData | IFilenameSourceData | null; // To compute which image should be taken from the tiles
  name: string; // Displayed name
  source: Sources; // Source of the dimension
}

interface IAssignment {
  text: string;
  value: IAssignmentOption;
}

@Component({
  components: {}
})
export default class NewDataset extends Vue {
  readonly store = store;

  tilesInternalMetadata: { [key: string]: any }[] | null = null;
  tilesMetadata: ITileMeta[] | null = null;

  enableCompositing: boolean = false;

  get datasetId() {
    return this.$route.params.id;
  }

  // Call join on the array, cutting out elements or the first word if too long and adding hyphens
  // Output is always shorter than maxChars
  // For example: ["foo", "bar", "foobar", "barfoo"] => "foo, bar, foobar..."
  sliceAndJoin(arr: string[], maxChars: number = 16, sep: string = ", ") {
    if (arr.length <= 0) {
      return "";
    }
    // First element is too long
    if (
      arr[0].length > maxChars ||
      (arr[0].length === maxChars && arr.length > 1)
    ) {
      return arr[0].slice(0, maxChars - 1) + "…";
    }
    // Add words until the limit of characters is reached or exceeded
    let nWords = 1;
    let nChars = arr[0].length;
    while (nChars < maxChars && nWords < arr.length) {
      nChars += sep.length + arr[nWords].length;
      ++nWords;
    }
    // The whole string fits
    if (nChars <= maxChars && nWords === arr.length) {
      return arr.join(sep);
    }
    // Remove the last word and add hyphens
    return arr.slice(0, nWords - 1).join(sep) + "…";
  }

  get canDoCompositing() {
    return (
      this.tilesInternalMetadata !== null &&
      this.tilesInternalMetadata.length === 1 &&
      this.tilesInternalMetadata[0].nd2_frame_metadata &&
      this.tilesMetadata !== null &&
      this.tilesMetadata.length === 1
    );
  }

  get shouldDoCompositing() {
    return this.canDoCompositing && this.enableCompositing;
  }

  get items() {
    return this.dimensions
      .filter(dim => dim.size > 0)
      .map((dim: IAssignmentOption) => {
        let values = "";
        switch (dim.source) {
          case Sources.Filename:
            values = this.sliceAndJoin(
              (dim.data as IFilenameSourceData).values
            );
            break;
          case Sources.File:
            values = "From metadata";
            break;
        }
        return {
          ...dim,
          values,
          key: `${dim.id}_${dim.guess}_${dim.source}`
        };
      });
  }

  dimensions: IAssignmentOption[] = [];

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
      value: "guess"
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

  readonly dimensionNames: { [dim in TDimensions]: string } = {
    XY: "Positions",
    Z: "Z",
    T: "Time",
    C: "Channels"
  };

  assignmentOptionToAssignmentItem(dimension: IAssignmentOption): IAssignment {
    return {
      text: dimension.name,
      value: dimension
    };
  }

  get assignmentItems() {
    const assignedDimensions = Object.entries(this.assignments).reduce(
      (assignedDimensions, [_, assignment]) =>
        assignment
          ? [...assignedDimensions, assignment.value.id]
          : assignedDimensions,
      [] as number[]
    );

    const isNotAssigned = (dimension: IAssignmentOption) =>
      !assignedDimensions.includes(dimension.id);
    return this.items
      .filter(isNotAssigned)
      .map(this.assignmentOptionToAssignmentItem);
  }

  assignments: { [dimension: string]: IAssignment | null } = {
    XY: null,
    Z: null,
    T: null,
    C: null
  };

  searchInput: string = "";
  filenameVariableCount = 0;
  fileVariableCount = 0;
  imageVariableCount = 0;
  assignmentIdCount = 0;

  addSizeToDimension(
    guess: TDimensions,
    size: number,
    source: Sources,
    data: IFileSourceData | IFilenameSourceData | null,
    name: string | null = null
  ) {
    if (size === 0) {
      return;
    }
    // Merge the dimension when the source is file and source and guess match
    const dim =
      source === Sources.File &&
      this.dimensions.find(
        dimension => dimension.source === source && dimension.guess === guess
      );
    if (dim) {
      dim.data = {
        ...(dim.data as IFileSourceData),
        ...(data as IFileSourceData)
      };
      dim.size += size;
    } else {
      // If no merge, compute the name if needed and add to this.dimensions
      let computedName = name;
      if (!computedName) {
        computedName = "";
        switch (source) {
          case Sources.Filename:
            computedName = `Filename variable ${++this.filenameVariableCount}`;
            break;
          case Sources.File:
            computedName = `Metadata ${++this.fileVariableCount} (${
              this.dimensionNames[guess]
            }) `;
            break;
          case Sources.Images:
            computedName = `Image variable ${++this.imageVariableCount}`;
            break;
        }
      }
      this.dimensions = [
        ...this.dimensions,
        {
          id: this.assignmentIdCount++,
          guess,
          size,
          name: computedName,
          source,
          data
        }
      ];
    }
  }

  girderItems: IGirderItem[] = [];

  getDefaultAssignmentItem(assignment: string) {
    const assignmentOption =
      this.dimensions.find(
        ({ guess, source, size }) =>
          source === Sources.File && size > 0 && guess === assignment
      ) ||
      this.dimensions.find(
        ({ guess, size }) => size > 0 && guess === assignment
      ) ||
      null;
    if (assignmentOption) {
      return this.assignmentOptionToAssignmentItem(assignmentOption);
    } else {
      return null;
    }
  }

  @Watch("datasetId")
  async mounted() {
    // Get tile information
    const items = await this.store.api.getItems(this.datasetId);
    this.girderItems = items;

    //  Get info from filename
    const names = items.map(item => item.name);

    collectFilenameMetadata2(names).forEach(filenameData =>
      this.addSizeToDimension(
        filenameData.guess,
        filenameData.values.length,
        Sources.Filename,
        filenameData
      )
    );

    // Get info from file
    this.tilesMetadata = await Promise.all(
      items.map(item => this.store.api.getTiles(item))
    );
    this.tilesInternalMetadata = await Promise.all(
      items.map(item => this.store.api.getTilesInternalMetadata(item))
    );

    let maxFramesPerItem = 0;
    let hasFileVariable = false;
    this.tilesMetadata.forEach((tile, tileIdx) => {
      const frames: number = tile.frames?.length || 1;
      maxFramesPerItem = Math.max(maxFramesPerItem, frames);
      if (tile.IndexRange && tile.IndexStride) {
        hasFileVariable = true;
        for (const dim in this.dimensionNames) {
          const indexDim = `Index${dim}`;
          this.addSizeToDimension(
            // We know that the keys of this.dimensionNames are of type TDimensions
            dim as TDimensions,
            tile.IndexRange[indexDim],
            Sources.File,
            {
              [tileIdx]: {
                range: tile.IndexRange[indexDim],
                stride: tile.IndexStride[indexDim],
                values: dim === "C" ? tile.channels : null
              }
            }
          );
        }
      }
    });

    if (!hasFileVariable) {
      this.addSizeToDimension(
        "Z",
        maxFramesPerItem,
        Sources.Images,
        null,
        "All frames per item"
      );
    }

    this.resetDimensionsToDefault();
  }

  resetDimensionsToDefault() {
    for (const dim in this.dimensionNames) {
      this.assignments[dim] = this.getDefaultAssignmentItem(dim);
    }
  }

  areDimensionsSetToDefault() {
    return Object.keys(this.dimensionNames).every(
      dim =>
        this.getDefaultAssignmentItem(dim)?.value ===
        this.assignments[dim]?.value
    );
  }

  canSubmit() {
    const filledAssignments = Object.values(this.assignments).reduce(
      (count, assignment) => (assignment ? ++count : count),
      0
    );
    return filledAssignments >= this.items.length || filledAssignments >= 4;
  }

  getValueFromAssignments(
    dim: TDimensions,
    itemIdx: number,
    frameIdx: number
  ): number {
    const assignmentValue = this.assignments[dim]?.value;
    if (!assignmentValue) {
      return 0;
    }
    switch (assignmentValue.source) {
      case Sources.File:
        const fileData = assignmentValue.data as IFileSourceData;
        return fileData[itemIdx]
          ? Math.floor(frameIdx / fileData[itemIdx].stride) %
              fileData[itemIdx].range
          : 0;
      case Sources.Filename:
        const filenameData = assignmentValue.data as IFilenameSourceData;
        const filename = this.girderItems[itemIdx].name;
        return filenameData.valueIdxPerFilename[filename];
      case Sources.Images:
        return frameIdx;
      case undefined:
        return 0;
    }
  }

  async generateJson() {
    // Find the channel names
    let channels: string[] | null = null;
    const channelAssignment = this.assignments.C?.value;
    if (channelAssignment) {
      switch (channelAssignment.source) {
        case Sources.File:
          // For each channel index, find the possible different channel names
          const fileData = channelAssignment.data as IFileSourceData;
          const channelsPerIdx = [] as string[][];
          for (const itemIdx in fileData) {
            const values = fileData[itemIdx].values;
            if (values) {
              for (let chanIdx = 0; chanIdx < values.length; ++chanIdx) {
                if (!channelsPerIdx[chanIdx]) {
                  channelsPerIdx[chanIdx] = [];
                }
                if (!channelsPerIdx[chanIdx].includes(values[chanIdx])) {
                  channelsPerIdx[chanIdx].push(values[chanIdx]);
                }
              }
            }
          }
          channels = [];
          for (const channelsAtIdx of channelsPerIdx) {
            channels.push(channelsAtIdx.join("/"));
          }
          break;
        case Sources.Filename:
          const filenameData = channelAssignment.data as IFilenameSourceData;
          channels = filenameData.values;
          break;
        case Sources.Images:
          channels = [...Array(channelAssignment.size).keys()].map(
            id => `Default ${id}`
          );
          break;
      }
    }
    if (channels === null || channels.length === 0) {
      channels = ["Default"];
    }

    // Find all possible (XY, Z, T, C)
    const sources: {
      path: string;
      xySet: number;
      zSet: number;
      tSet: number;
      cSet: number;
      frames: number[];
      position?: { x: number; y: number };
    }[] = [];
    if (!this.tilesMetadata) {
      return;
    }
    for (let itemIdx = 0; itemIdx < this.girderItems.length; ++itemIdx) {
      const item = this.girderItems[itemIdx];
      const nFrames = this.tilesMetadata[itemIdx].frames.length;
      for (let frameIdx = 0; frameIdx < nFrames; ++frameIdx) {
        sources.push({
          path: item.name,
          xySet: this.getValueFromAssignments("XY", itemIdx, frameIdx),
          zSet: this.getValueFromAssignments("Z", itemIdx, frameIdx),
          tSet: this.getValueFromAssignments("T", itemIdx, frameIdx),
          cSet: this.getValueFromAssignments("C", itemIdx, frameIdx),
          frames: [frameIdx]
        });
      }
    }

    // Compositing
    if (this.shouldDoCompositing) {
      const { mm_x, mm_y } = this.tilesMetadata![0];
      const framesMetadata = this.tilesInternalMetadata![0].nd2_frame_metadata;
      const coordinates: IGeoJSPoint[] = framesMetadata.map((f: any) => {
        const framePos = f.position.stagePositionUm;
        return {
          x: framePos[0] / (mm_x * 1000),
          y: framePos[1] / (mm_y * 1000)
        };
      });
      const minCoordinate = {
        x: Math.min(...coordinates.map(coordinate => coordinate.x)),
        y: Math.min(...coordinates.map(coordinate => coordinate.y))
      };
      const maxCoordinate = {
        x: Math.max(...coordinates.map(coordinate => coordinate.x)),
        y: Math.max(...coordinates.map(coordinate => coordinate.y))
      };
      const intCoordinates = coordinates.map(coordinate => ({
        x: Math.round(coordinate.x - minCoordinate.x),
        y: Math.round(maxCoordinate.y - coordinate.y)
      }));

      sources.forEach((source, sourceIdx) => {
        source.position =
          intCoordinates[Math.floor(sourceIdx / channels!.length)];
        source.xySet = 0;
      });
    }

    await this.store.addMultiSourceMetadata({
      parentId: this.datasetId,
      metadata: JSON.stringify({ channels, sources })
    });
    this.$router.push({
      name: "dataset",
      params: {
        id: this.datasetId
      }
    });
  }
}
</script>
