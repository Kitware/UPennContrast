<template>
  <v-menu v-model="userMenu" close-on-click>
    <template #activator="{ on }">
      <v-btn v-on="on">
        {{ store.userName }}
      </v-btn>
    </template>
    <v-dialog :value="true" max-width="20vw" v-if="!store.isLoggedIn">
      <v-alert :value="Boolean(error)" color="error">
        {{ error }}
      </v-alert>
      <v-container class="loginDialog">
        <v-form @submit.prevent="login">
          <v-text-field
            v-model="domain"
            label="Girder Domain"
            required
            prepend-icon="$vuetify.icons.user"
          />
          <v-text-field
            v-model="username"
            label="Username or e-mail"
            autofocus
            required
            prepend-icon="$vuetify.icons.user"
          />
          <v-text-field
            v-model="password"
            type="password"
            label="Password"
            prepend-icon="$vuetify.icons.lock"
          />
          <v-card-actions>
            <v-btn type="submit" color="primary">
              Login
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-container>
    </v-dialog>
    <v-list v-else>
      <v-divider />
      <v-list-item @click="logout">
        <v-list-item-title>Logout</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script lang="ts">
import { Vue, Component, Inject } from "vue-property-decorator";
import store from "@/store";

@Component
export default class UserMenu extends Vue {
  userMenu = false;
  loginDialog = false;

  readonly store = store;

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
      this.loginDialog = false;
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
