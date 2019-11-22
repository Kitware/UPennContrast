<template>
  <v-menu
    v-model="userMenu"
    close-on-click
    offset-y
    :close-on-content-click="store.isLoggedIn"
    transition="slide-y"
  >
    <template #activator="{ on }">
      <v-btn v-on="on">{{ store.userName }}</v-btn>
    </template>
    <v-container v-if="!store.isLoggedIn" class="loginDialog">
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
          autofocus
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
        <v-card-actions>
          <v-btn type="submit" color="primary">
            Login
          </v-btn>
        </v-card-actions>
      </v-form>
      <v-alert :value="Boolean(error)" color="error">{{ error }}</v-alert>
    </v-container>
    <v-list v-else dense>
      <v-divider />
      <v-list-item @click="logout">
        <v-list-item-avatar>
          <v-icon>mdi-logout</v-icon>
        </v-list-item-avatar>
        <v-list-item-title>Logout</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class UserMenu extends Vue {
  readonly store = store;

  userMenu = false;

  domain = store.girderUrl;
  username = "";
  password = "";

  error = "";

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
  }
}
</script>

<style lang="scss" scoped>
.loginDialog {
  background: white;
}
</style>
