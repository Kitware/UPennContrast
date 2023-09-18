<template>
  <v-card>
    <v-card-title>
      Hotkeys
    </v-card-title>
    <v-card-text class="container">
      <p v-for="[sectionName, sectionItems] of hotkeyItems" :key="sectionName">
        <span class="title span-title">
          {{ sectionName }}
        </span>
        <br />
        <template v-for="({ key, description }, i) of sectionItems">
          <code class="caption" :key="i + '_key'">{{ key }}</code>
          <span class="text--primary pl-2" :key="i + '_description'">
            {{ description }}
          </span>
          <br :key="i + '_br'" />
        </template>
      </p>
    </v-card-text>
    <v-divider />
    <v-card-title>
      Features
    </v-card-title>
    <v-card-text class="container">
      <p v-for="[sectionName, sectionItems] of featureItems" :key="sectionName">
        <span class="title span-title">
          {{ sectionName }}
        </span>
        <br />
        <template v-for="({ title, description }, i) of sectionItems">
          <code :key="i + '_title'" class="caption">{{ title }}</code>
          <span :key="i + '_description'" class="text--primary pl-2">
            {{ description }}
          </span>
          <br :key="i + '_br'" />
        </template>
      </p>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import { boundKeys } from "@/utils/v-mousetrap";
import { IFeatureDescription, descriptions } from "@/utils/v-description";

@Component({})
export default class HotkeyDescription extends Vue {
  readonly boundKeys = boundKeys;
  readonly descriptions = descriptions;

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
    const items = [...sections.entries()];
    items.sort();
    return items;
  }

  get featureItems() {
    const sections: Map<string, IFeatureDescription[]> = new Map();
    for (const desc of Object.values(this.descriptions)) {
      if (!sections.has(desc.section)) {
        sections.set(desc.section, []);
      }
      const section = sections.get(desc.section);
      section!.push(desc);
    }
    const items = [...sections.entries()];
    items.sort();
    return items;
  }
}
</script>

<style lang="scss" scoped>
.container {
  column-width: 300px;
  column-gap: 20px;
  column-fill: balance;
  column-rule: inset;
  orphans: 4;
}

.span-title {
  line-height: 3em;
}
</style>
