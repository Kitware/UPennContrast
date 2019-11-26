<template>
  <v-app id="inspire">
    <v-app-bar app clipped-right>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title @click="goHome" class="logo"
        >UPenn Contrast</v-toolbar-title
      >
      <BreadCrumbs />
      <v-spacer />
      <UserMenu />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app>
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
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {
    Menu,
    UserMenu,
    BreadCrumbs
  }
})
export default class App extends Vue {
  drawer = false;

  goHome() {
    this.$router.push({ name: "home" });
  }
}
</script>
<style lang="scss" scoped>
.logo {
  cursor: pointer;
}
</style>

<style lang="scss">
.grow {
  flex: 1 1 0;
}
</style>
