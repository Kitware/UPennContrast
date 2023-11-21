<template>
  <v-dialog v-model="isAlertOpen">
    <v-alert v-if="alert" class="ma-0" :type="alert.type">
      {{ alert.message }}
    </v-alert>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

export interface IAlert {
  type: "success" | "info" | "warning" | "error" | undefined;
  message: string;
}

@Component({})
export default class AlertDialog extends Vue {
  alert: IAlert | null = null;

  get isAlertOpen() {
    return this.alert !== null;
  }

  set isAlertOpen(val: boolean) {
    if (!val) {
      this.alert = null;
    } else {
      this.alert = {
        type: "info",
        message: "Unknown alert"
      };
    }
  }

  openAlert(alert: IAlert) {
    this.alert = alert;
  }
}
</script>
