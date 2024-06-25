<template>
  <div>
    <v-dialog v-model="userMenu" v-if="!store.isLoggedIn" max-width="400px">
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
        <div class="text-center mb-4">
          <v-img
            src="/public/img/icons/NimbusImageIcon.png"
            max-height="80"
            contain
            class="mb-2"
          ></v-img>
          <h2 class="text-h5 font-weight-bold mb-2">Welcome to NimbusImage!</h2>
          <p class="text-subtitle-1">
            A cloud-based image analysis platform from the Raj Lab at the
            University of Pennsylvania and Kitware
          </p>
        </div>
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
            <v-btn type="submit" color="primary">Login</v-btn>
          </v-card-actions>
        </v-form>
        <v-alert :value="Boolean(error)" color="error">{{ error }}</v-alert>
        <div class="text-center mt-4">
          <a
            href="https://arjun-raj-lab.gitbook.io/nimbusimage"
            target="_blank"
            class="info-link"
          >
            More information
          </a>
          <br />
          <a
            href="https://arjun-raj-lab.gitbook.io/nimbusimage/quick-start#sign-up"
            target="_blank"
            class="signup-link"
          >
            Sign up
          </a>
        </div>
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

.loginDialog {
  padding: 20px;
}

.info-link,
.signup-link {
  display: inline-block;
  margin: 5px 0;
  color: #64b5f6; // A lighter blue that works well with dark themes
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
