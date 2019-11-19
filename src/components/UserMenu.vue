<template>
  <v-menu v-model="userMenu" close-on-click>
    <template #activator="{ on }">
      <v-btn icon v-on="on">
        <v-icon>mdi-account-circle</v-icon>
      </v-btn>
    </template>
    <v-dialog :value="true" max-width="20vw" v-if="!isLoggedIn">
      <authentication
        :force-otp="false"
        :register="true"
        :oauth="true"
        :key="girderRest.token"
        :forgot-password-url="forgotPasswordUrl"
      />
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
import { Authentication, RestClient } from "@/girder";

@Component({
  components: {
    Authentication
  }
})
export default class UserMenu extends Vue {
  @Inject("girderRest")
  private girderRest!: RestClient;

  readonly forgotPasswordUrl = "/#?dialog=resetpassword";

  userMenu = false;
  loginDialog = false;

  get loggedOut() {
    return this.girderRest.user === null;
  }

  get isLoggedIn() {
    return this.girderRest.user != null;
  }

  get currentUserLogin() {
    return this.girderRest.user ? this.girderRest.user.login : "anonymous";
  }

  logout() {
    this.girderRest.logout();
  }
}
</script>
