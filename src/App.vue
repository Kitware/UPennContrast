<template>
  <v-app id="inspire">
    <v-app-bar class="elevation-1" app clipped-right>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title @click="goHome" class="logo"
        >UPenn Contrast</v-toolbar-title
      >
      <bread-crumbs />
      <v-spacer />
      <v-btn @click.stop="snapshotPanel = !snapshotPanel" id="snapshotButton"
        >Snapshot</v-btn
      >
      <user-menu />
      <server-status />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app disable-resize-watcher>
      <Menu />
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
    <v-navigation-drawer
      v-model="snapshotPanel"
      app
      right
      disable-resize-watcher
      clipped
      hide-overlay
      :width="320"
    >
      <snapshots :snapshotVisible="snapshotPanel" />
    </v-navigation-drawer>
  </v-app>
</template>

<script lang="ts">
import axios from "axios";
import Menu from "./layout/Menu.vue";
import UserMenu from "./layout/UserMenu.vue";
import ServerStatus from "./components/ServerStatus.vue";
import Snapshots from "./components/Snapshots.vue";
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import vMousetrap from "./utils/v-mousetrap";
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";

Vue.use(vMousetrap);

@Component({
  components: {
    Menu,
    UserMenu,
    BreadCrumbs,
    ServerStatus,
    Snapshots
  }
})
export default class App extends Vue {
  readonly store = store;
  drawer = false;
  snapshotPanel = false;

  fetchConfig() {
    axios
      .get("config/modes.json")
      .then(resp => {
        this.store.setAnnotationModeList(resp.data.annotation_buttons);
      })
      .catch(err => {
        console.log(err); // eslint-disable-line no-console
        throw err;
      });
  }

  mounted() {
    this.fetchConfig();
  }

  goHome() {
    this.$router.push({ name: "root" });
  }
}
</script>
<style lang="scss" scoped>
.logo {
  cursor: pointer;
}
#snapshotButton {
  margin-right: 1em;
}
</style>
<style lang="scss">
body > div {
  overflow: hidden;
}
</style>
