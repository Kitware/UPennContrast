<template>
  <div>
    <v-dialog v-model="userMenu" v-if="!store.isLoggedIn" max-width="400px">
      <template #activator="{ on }">
        <v-btn v-on="on">Login</v-btn>
      </template>
      <v-container class="pa-0">
        <v-card class="pa-6">
          <template v-if="!signUpMode">
            <div class="text-center mb-8">
              <v-img
                src="/img/icons/NimbusImageIcon.png"
                max-height="80"
                contain
                class="mb-2"
              />
              <h2 class="text-h5 font-weight-bold mb-2">
                Welcome to NimbusImage!
              </h2>
              <p class="text-subtitle-1">
                A cloud-based image analysis platform from the Raj Lab at the
                University of Pennsylvania and Kitware
              </p>
            </div>
            <v-alert :value="!!successMessage" type="success">{{
              successMessage
            }}</v-alert>
            <v-form @submit.prevent="login" class="my-8">
              <v-text-field
                v-if="!isGirderUrlSet"
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
            <v-alert :value="!!error" color="error">{{ error }}</v-alert>
            <div class="text-center mt-4">
              <a
                href="https://arjun-raj-lab.gitbook.io/nimbusimage"
                target="_blank"
                class="link"
              >
                More information
              </a>
              <br />
              <v-btn text class="link" @click="switchToSignUp">Sign up</v-btn>
            </div>
          </template>
          <template v-else>
            <div class="text-center mb-8">
              <v-img
                src="/img/icons/NimbusImageIcon.png"
                max-height="80"
                contain
                class="mb-2"
              />
              <h2 class="text-h5 font-weight-bold mb-2">
                Sign up for NimbusImage!
              </h2>
              <p class="text-subtitle-1">
                Create a new account to get started.
              </p>
            </div>
            <v-form @submit.prevent="signUp" class="my-8">
              <v-text-field
                v-model="signupUsername"
                name="username"
                label="Username"
                required
                prepend-icon="mdi-account"
              />
              <v-text-field
                v-model="signupEmail"
                name="email"
                label="Email"
                required
                prepend-icon="mdi-email"
              />
              <v-text-field
                v-model="signupFirstName"
                name="firstName"
                label="First Name"
                required
                prepend-icon="mdi-account"
              />
              <v-text-field
                v-model="signupLastName"
                name="lastName"
                label="Last Name"
                required
                prepend-icon="mdi-account"
              />
              <v-text-field
                v-model="signupPassword"
                name="password"
                type="password"
                label="Password"
                required
                prepend-icon="mdi-lock"
              />
              <v-card-actions class="button-bar">
                <v-btn type="submit" color="primary">Sign up</v-btn>
                <v-spacer></v-spacer>
                <v-btn text @click="switchToLogin">Back to login</v-btn>
              </v-card-actions>
            </v-form>
            <v-alert :value="!!error" color="error">{{ error }}</v-alert>
            <div class="text-center mt-4">
              <a
                href="https://arjun-raj-lab.gitbook.io/nimbusimage"
                target="_blank"
                class="link"
              >
                More information
              </a>
            </div>
          </template>
        </v-card>
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
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import userAPI from "@/store/UserAPI";
import UserProfileSettings from "@/components/UserProfileSettings.vue";

@Component({
  components: {
    UserProfileSettings,
  },
})
export default class UserMenu extends Vue {
  readonly store = store;

  userMenu: boolean = false;

  domain = store.girderUrl;
  username = import.meta.env.VITE_DEFAULT_USER || "";
  password = import.meta.env.VITE_DEFAULT_PASSWORD || "";

  error = "";
  successMessage = "";

  signUpMode: boolean = false;
  signupUsername: string = "";
  signupEmail: string = "";
  signupFirstName: string = "";
  signupLastName: string = "";
  signupPassword: string = "";

  get isGirderUrlSet(): boolean {
    return !!import.meta.env.VITE_GIRDER_URL;
  }

  async mounted() {
    this.loggedInOrOut();
    if (this.username && this.password) {
      await this.login();
    }
  }

  @Watch("store.isLoggedIn")
  loggedInOrOut() {
    this.userMenu = !store.isLoggedIn;
  }

  async login() {
    this.error = "";
    this.successMessage = "";
    try {
      const result = await store.login({
        domain: this.domain,
        username: this.username,
        password: this.password,
      });
      if (result) {
        this.error = result;
      } else {
        this.userMenu = false;
      }
    } finally {
      this.password = "";
    }
  }

  async signUp() {
    this.error = "";
    this.successMessage = "";

    const result = await store.userAPI.signUp({
      login: this.signupUsername,
      email: this.signupEmail,
      firstName: this.signupFirstName,
      lastName: this.signupLastName,
      password: this.signupPassword,
      admin: false,
    });

    if (result.success) {
      // Handle successful signup
      this.signUpMode = false;
      this.clearSignupFields();
      this.successMessage =
        "Sign-up successful! Please verify your email before logging in.";
    } else {
      // Handle signup error from API
      this.error = result.message; // result.field would tell you what field was invalid in case you needed it
    }
  }

  clearSignupFields() {
    this.signupUsername = "";
    this.signupEmail = "";
    this.signupFirstName = "";
    this.signupLastName = "";
    this.signupPassword = "";
  }

  switchToSignUp() {
    this.signUpMode = true;
    this.error = "";
    this.successMessage = "";
  }

  switchToLogin() {
    this.signUpMode = false;
    this.error = "";
    this.successMessage = "";
  }
}
</script>

<style lang="scss" scoped>
.link {
  display: inline-block;
  margin: 5px 0;
  color: #64b5f6; // A lighter blue that works well with dark themes
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
