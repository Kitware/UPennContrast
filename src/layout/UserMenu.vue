<template>
  <div>
    <v-dialog v-model="initialDialog" v-if="!store.isLoggedIn" max-width="300px">
      <template #activator="{ on }">
        <v-btn v-on="on">{{ store.userName || 'Login / Sign Up' }}</v-btn>
      </template>
      <v-card>
        <v-card-title>Welcome to NimbusImage</v-card-title>
        <v-card-text>
          <v-btn @click="showLoginDialog" color="primary" block class="mb-2">Login</v-btn>
          <v-btn @click="showSignUpDialog" color="secondary" block>Sign Up</v-btn>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="loginDialog" max-width="300px">
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
            <v-btn type="submit" color="primary">Login</v-btn>
          </v-card-actions>
        </v-form>
        <v-alert :value="Boolean(error)" color="error">{{ error }}</v-alert>
      </v-container>
    </v-dialog>

    <v-dialog v-model="signUpDialog" max-width="400px">
      <v-card>
        <v-card-title>Sign Up for NimbusImage</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="submitSignUp">
            <v-text-field v-model="signUpForm.name" label="Name" required></v-text-field>
            <v-text-field v-model="signUpForm.email" label="Email" required type="email"></v-text-field>
            <v-text-field v-model="signUpForm.institution" label="Institution (optional)"></v-text-field>
            <v-textarea v-model="signUpForm.purpose" label="What are you hoping to use NimbusImage for? (optional)"></v-textarea>
            <v-btn type="submit" color="primary" block>Submit</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-menu
      v-if="store.isLoggedIn"
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
import axios from "axios";

@Component({
  components: {
    UserProfileSettings,
  },
})
export default class UserMenu extends Vue {
  readonly store = store;

  userMenu: boolean | string = "auto";
  initialDialog = false;
  loginDialog = false;
  signUpDialog = false;

  domain = store.girderUrl;
  username = import.meta.env.VITE_DEFAULT_USER || "";
  password = import.meta.env.VITE_DEFAULT_PASSWORD || "";

  signUpForm = {
    name: "",
    email: "",
    institution: "",
    purpose: "",
  };

  error = "";

  mounted() {
    // delay auto open for auto relogin to finish
    setTimeout(() => {
      if (this.userMenu === "auto") {
        this.userMenu = false;
        if (this.username && this.password) {
          this.login();
        }
        setTimeout(() => {
          if (!this.userMenu) {
            this.initialDialog = !store.isLoggedIn;
          }
        }, 500);
        return;
      }
      if (!this.userMenu) {
        this.initialDialog = !store.isLoggedIn;
      }
    }, 500);
  }

  showLoginDialog() {
    this.initialDialog = false;
    this.loginDialog = true;
  }

  showSignUpDialog() {
    this.initialDialog = false;
    this.signUpDialog = true;
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
      this.loginDialog = false;
    }
  }

  async submitSignUp() {
    try {
      // Replace this URL with your actual email endpoint
      await axios.post('/api/signup', this.signUpForm);
      this.signUpDialog = false;
      // Show a success message or redirect the user
      alert('Thank you for signing up! We will contact you shortly.');
    } catch (error) {
      console.error('Error submitting sign-up form:', error);
      alert('There was an error submitting your sign-up information. Please try again.');
    }
  }
}
</script>

<style lang="scss" scoped>
.loginDialog.theme--light {
  background: white;
}
</style>