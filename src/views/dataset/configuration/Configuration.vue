<template>
  <router-view></router-view>
</template>
<script lang="ts">
import store from "@/store";
import routeMapper from "@/utils/routeMapper";
import { CompositionMode } from "@/store/model";
import { DEFAULT_COMPOSITION_MODE } from "@/store/constants";

export default routeMapper(
  {
    config: {
      parse: String,
      get: () => store.selectedConfigurationId,
      set: (value: string) => store.setSelectedConfiguration(value)
    }
  },
  {
    xy: {
      parse: v => parseInt(v, 10),
      get: () => store.xy,
      set: (value: number) => store.setXY(value || 0)
    },
    unrollXY: {
      parse: v => v === 'true',
      get: () => store.splayXY,
      set: (value: boolean) => store.setSplayXY(value)
    },
    z: {
      parse: v => parseInt(v, 10),
      get: () => store.z,
      set: (value: number) => store.setZ(value || 0)
    },
    unrollZ: {
      parse: v => v === 'true',
      get: () => store.splayZ,
      set: (value: boolean) => store.setSplayZ(value)
    },
    time: {
      parse: v => parseInt(v, 10),
      get: () => store.time,
      set: (value: number) => store.setTime(value || 0)
    },
    unrollT: {
      parse: v => v === 'true',
      get: () => store.splayT,
      set: (value: boolean) => store.setSplayT(value)
    },
    mode: {
      parse: v => v as CompositionMode,
      get: () => store.compositionMode,
      set: (value: CompositionMode) =>
        store.setCompositionMode(value || DEFAULT_COMPOSITION_MODE)
    },
    layer: {
      parse: v => v,
      get: () => store.layerMode,
      set: (value: string) =>
        store.setLayerMode(value === "single" ? "single" : "multiple")
    }
  }
);
</script>
