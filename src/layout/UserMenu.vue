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
          'theme--dark': $vuetify.theme.dark,
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
            <v-btn type="submit" color="primary"> Login </v-btn>
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
      :close-on-content-click="false"
    >
      <template #activator="{ on }">
        <v-btn icon v-on="on">
          <v-icon>mdi-account-circle</v-icon>
        </v-btn>
      </template>
      <v-card>
        <user-profile-settings />
      </v-card>
    </v-menu>
  </div>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import UserProfileSettings from "@/components/UserProfileSettings.vue";

@Component({
  components: {
    UserProfileSettings,
  },
})
export default class UserMenu extends Vue {
  readonly store = store;

  userMenu: boolean | string = "auto";

  domain = store.girderUrl;
  username = import.meta.env.VITE_DEFAULT_USER || "";
  password = import.meta.env.VITE_DEFAULT_PASSWORD || "";

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
      password: this.password,
    });
    if (result) {
      this.password = "";
      this.error = result;
    } else {
      this.error = "";
      this.userMenu = false;
    }
  }
}
</script>

<style lang="scss" scoped>
.loginDialog.theme--light {
  background: white;
}
</style>
