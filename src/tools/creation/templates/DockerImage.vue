<template>
  <v-container>
    <v-row>
      <v-col class="pa-0">
        <docker-image-select v-model="image"></docker-image-select>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import DockerImageSelect from "@/components/DockerImageSelect.vue";

// Tool creation interface element for choosing a docker image among available ones
@Component({
  components: {
    DockerImageSelect
  }
})
export default class DockerImage extends Vue {
  readonly store = store;

  image: String | null = null;

  @Prop()
  readonly value!: any;

  mounted() {
    this.reset();
  }

  reset() {
    this.image = null;
    this.changed();
  }

  @Prop()
  readonly template!: any;

  @Watch("image")
  changed() {
    this.$emit("input", { image: this.image });
    this.$emit("change");
  }
}
</script>
