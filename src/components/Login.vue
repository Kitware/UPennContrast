<template>
  <authentication
    :force-otp="false"
    :register="true"
    :oauth="true"
    :key="girderRest.token"
    :forgot-password-url="forgotPasswordUrl"
  />
</template>

<script lang="ts">
import { Vue, Component, Inject } from "vue-property-decorator";
import { Authentication } from "@girder/components/src/components";
import { IGirderRestClient } from "../girder";

@Component({
  components: {
    Authentication
  }
})
export default class Login extends Vue {
  @Inject("girderRest")
  private girderRest!: IGirderRestClient;

  readonly forgotPasswordUrl = "/#?dialog=resetpassword";

  get loggedOut() {
    return this.girderRest.user === null;
  }

  get currentUserLogin() {
    return this.girderRest.user ? this.girderRest.user.login : "anonymous";
  }
}
</script>
