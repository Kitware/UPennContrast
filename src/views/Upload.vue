<template>
  <div>Upload</div>
</template>
<script lang="ts">
import { Vue, Component, Inject } from "vue-property-decorator";
import store from "@/store";

@Component
export default class Upload extends Vue {
  readonly store = store;
}
</script>
