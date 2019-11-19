<template>
  <v-app id="inspire">
    <v-app-bar app clipped-right dark>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>UPenn Contrast</v-toolbar-title>
      <v-spacer />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app>
      <Menu />
      <Login />
    </v-navigation-drawer>

    <v-content>
      <router-view />
    </v-content>

    <v-footer app>
      <span>Kitware</span>
      <v-spacer />
      <span>&copy; 2019</span>
    </v-footer>
  </v-app>
</template>

<script lang="ts">
import Vue from "vue";
import Menu from "./components/Menu.vue";
import Login from "./components/Login.vue";

export default Vue.extend({
  name: "App",

  components: {
    Menu,
    Login
  },

  data: () => ({
    drawer: false
  })
});
</script>
