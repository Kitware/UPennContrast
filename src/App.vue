<template>
  <v-app id="inspire">
    <v-app-bar app clipped-right>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title @click="goHome" class="logo"
        >UPenn Contrast</v-toolbar-title
      >
      <bread-crumbs />
      <v-spacer />
      <user-menu />
      <server-status />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app disable-resize-watcher>
      <Menu />
    </v-navigation-drawer>

    <v-content>
      <router-view />
    </v-content>

    <!-- <v-footer app>
      <span>Kitware</span>
      <v-spacer />
      <span>&copy; 2019</span>
    </v-footer>-->
  </v-app>
</template>

<script lang="ts">
import Menu from "./layout/Menu.vue";
import UserMenu from "./layout/UserMenu.vue";
import ServerStatus from "./components/ServerStatus.vue";
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {
    Menu,
    UserMenu,
    BreadCrumbs,
    ServerStatus
  }
})
export default class App extends Vue {
  drawer = false;

  goHome() {
    this.$router.push({ name: "root" });
  }
}
</script>
<style lang="scss" scoped>
.logo {
  cursor: pointer;
}
</style>
