<template>
  <router-view></router-view>
</template>
<script lang="ts">
import store from "@/store";
import routeMapper from "@/utils/routeMapper";

export default routeMapper({
  configurationId: {
    parse: String,
    get: () => store.selectedConfigurationId,
    set: (value: string) => store.setSelectedConfiguration(value)
  }
});
</script>
