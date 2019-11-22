<template>
  <v-app id="inspire">
    <v-app-bar app clipped-right>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>UPenn Contrast</v-toolbar-title>
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
import Vue from "vue";
import Menu from "./layout/Menu.vue";
import UserMenu from "./layout/UserMenu.vue";

export default Vue.extend({
  name: "App",

  components: {
    Menu,
    UserMenu
  },

  data: () => ({
    drawer: false
  })
});
</script>
