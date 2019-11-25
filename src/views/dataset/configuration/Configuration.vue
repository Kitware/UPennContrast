<template>
  <router-view></router-view>
</template>
<script lang="ts">
import store from "@/store";
import routeMapper from "@/utils/routeMapper";

export default routeMapper(
  "config",
  () => store.selectedConfigurationId,
  value => store.setSelectedConfiguration(value)
);
</script>
