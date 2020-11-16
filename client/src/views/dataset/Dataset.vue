<template>
  <router-view></router-view>
</template>
<script lang="ts">
import store from "@/store";
import routeMapper from "@/utils/routeMapper";

export default routeMapper({
  id: {
    parse: String,
    get: () => store.selectedDatasetId,
    set: (value: string) => store.setSelectedDataset(value)
  }
});
</script>
