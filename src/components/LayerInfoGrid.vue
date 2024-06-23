<template>
  <div class="layer-info-grid">
    <v-toolbar dense>
      <v-toolbar-title>Layer Information</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-container fluid>
      <v-row
        v-if="layers.length > 0"
        no-gutters
        class="flex-nowrap"
        style="overflow-x: auto"
      >
        <v-col v-for="layer in layers" :key="layer.id" cols="auto" class="mr-2">
          <v-card outlined width="200">
            <v-card-title class="text-subtitle-2">
              <v-icon :color="layer.color" small left>mdi-circle</v-icon>
              {{ layer.name }}
            </v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field
                    :value="layer.name"
                    @input="changeProp(layer.id, 'name', $event)"
                    label="Name"
                    dense
                    hide-details
                  />
                </v-col>
                <v-col cols="12">
                  <v-select
                    :value="layer.channel"
                    @change="changeProp(layer.id, 'channel', $event)"
                    :items="channelItems"
                    label="Channel"
                    dense
                    hide-details
                  />
                </v-col>
                <v-col cols="12">
                  <v-switch
                    v-model="layer.visible"
                    @change="toggleVisibility(layer.id)"
                    label="Visible"
                    dense
                    hide-details
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      <v-row v-else>
        <v-col>
          <v-alert type="info">No layers available.</v-alert>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator';
import { IDisplayLayer } from '../store/model';
import store from '../store';

@Component
export default class LayerInfoGrid extends Vue {
  @Prop({ required: true }) readonly layers!: IDisplayLayer[];

  get channelItems() {
    return store.dataset
      ? store.dataset.channels.map((channel) => ({
          text: this.channelName(channel),
          value: channel,
        }))
      : [];
  }

  channelName(channel: number): string {
    let result = channel.toString();
    if (store.dataset) {
      result = store.dataset.channelNames.get(channel) || result;
    }
    return result;
  }

  toggleVisibility(layerId: string) {
    store.toggleLayerVisibility(layerId);
  }

  changeProp(layerId: string, prop: keyof IDisplayLayer, value: any) {
    store.changeLayer({
      layerId,
      delta: {
        [prop]: value,
      },
    });
  }
}
</script>

<style lang="scss" scoped>
.layer-info-grid {
  background-color: white;
  max-width: 100vw;
}
</style>