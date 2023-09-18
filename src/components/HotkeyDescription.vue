<template>
  <v-card>
    <v-card-title>
      Hotkeys
    </v-card-title>
    <v-card-text class="hotkey-container">
      <div
        v-for="[sectionName, sectionItems] of hotkeyItems"
        :key="sectionName"
      >
        <div class="title mt-3 mb-2">
          {{ sectionName }}
        </div>
        <div>
          <div v-for="{ key, description } of sectionItems" :key="key">
            <code class="caption">{{ key }}</code>
            <span class="text--primary pl-2">{{ description }}</span>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import { boundKeys } from "@/utils/v-mousetrap";

@Component({})
export default class HotkeyDescription extends Vue {
  readonly boundKeys = boundKeys;

  get hotkeyItems() {
    const sections: Map<
      string,
      { key: string; description: string }[]
    > = new Map();
    for (const [key, data] of Object.entries(this.boundKeys)) {
      if (!sections.has(data.section)) {
        sections.set(data.section, []);
      }
      const section = sections.get(data.section);
      section!.push({
        key,
        description: data.description
      });
    }
    return sections.entries();
  }
}
</script>

<style lang="scss" scoped>
.hotkey-container {
  column-width: 300px;
  column-fill: auto;
  column-rule: inset;
  height: 80vh;
}
</style>
