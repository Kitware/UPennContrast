<template>
  <div>
    <v-dialog v-model="userMenu" v-if="!store.isLoggedIn" max-width="300px">
      <template #activator="{ on }">
        <v-btn v-on="on">{{ store.userName }}</v-btn>
      </template>
      <v-container
        :class="{
          loginDialog: true,
          'theme--light': !$vuetify.theme.dark,
          'theme--dark': $vuetify.theme.dark
        }"
      >
        <v-form @submit.prevent="login">
          <v-text-field
            v-model="domain"
            name="domain"
            label="Girder Domain"
            required
            prepend-icon="mdi-domain"
          />
          <v-text-field
            v-model="username"
            name="username"
            label="Username or e-mail"
            required
            prepend-icon="mdi-account"
          />
          <v-text-field
            v-model="password"
            name="password"
            type="password"
            label="Password"
            prepend-icon="mdi-lock"
          />
          <v-card-actions class="button-bar">
            <v-btn type="submit" color="primary">
              Login
            </v-btn>
          </v-card-actions>
        </v-form>
        <v-alert :value="Boolean(error)" color="error">{{ error }}</v-alert>
      </v-container>
    </v-dialog>
    <v-menu
      v-else
      v-model="userMenu"
      close-on-click
      offset-y
      :close-on-content-click="store.isLoggedIn"
      transition="slide-y"
      style="z-index: 20"
    >
      <template #activator="{ on }">
        <v-btn v-on="on">{{ store.userName }}</v-btn>
      </template>
      <v-list dense>
        <v-divider />
        <v-list-item @click="logout">
          <v-list-item-content>
            <v-list-item-title>
              <v-icon left>mdi-logout</v-icon>
              Logout
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class UserMenu extends Vue {
  readonly store = store;

  userMenu: boolean | string = "auto";

  domain = store.girderUrl;
  username = process.env.VUE_APP_DEFAULT_USER || "";
  password = process.env.VUE_APP_DEFAULT_PASSWORD || "";

  error = "";

  mounted() {
    // delay auto open for auto relogin to finish
    setTimeout(() => {
      // if the environment has a default user and password, login.
      if (this.userMenu === "auto") {
        this.userMenu = false;
        if (this.username && this.password) {
          this.login();
        }
        setTimeout(() => {
          if (!this.userMenu) {
            this.userMenu = !store.isLoggedIn;
          }
        }, 500);
        return;
      }
      if (!this.userMenu) {
        this.userMenu = !store.isLoggedIn;
      }
    }, 500);
  }

  async login() {
    this.error = "";
    const result = await store.login({
      domain: this.domain,
      username: this.username,
      password: this.password
    });
    if (result) {
      this.password = "";
      this.error = result;
    } else {
      this.error = "";
      this.userMenu = false;
    }
  }

  async logout() {
    await this.store.logout();
    this.userMenu = false;
    this.$router.push({ name: "root" });
  }
}
</script>
<style lang="scss" scoped>
.loginDialog.theme--light {
  background: white;
}
</style>
