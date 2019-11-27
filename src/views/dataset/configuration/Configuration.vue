<template>
  <router-view></router-view>
</template>
<script lang="ts">
import store from "@/store";
import routeMapper from "@/utils/routeMapper";

export default routeMapper(
  {
    config: {
      parse: String,
      get: () => store.selectedConfigurationId,
      set: (value: string) => store.setSelectedConfiguration(value)
    }
  },
  {
    z: {
      parse: v => parseInt(v, 10),
      get: () => store.z,
      set: (value: number) => store.setZ(value || 0)
    },
    time: {
      parse: v => parseInt(v, 10),
      get: () => store.time,
      set: (value: number) => store.setTime(value || 0)
    }
  }
);
</script>
