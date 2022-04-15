import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";

import { IComputeJob } from "./model";

import Vue from "vue";

import main from "./index";

import { logError } from "@/utils/log";

const jobStates = {
  inactive: 0,
  queued: 1,
  running: 2,
  success: 3,
  error: 4,
  cancelled: 5,
  cancelling: 824
};

@Module({ dynamic: true, store, name: "jobs" })
export class Jobs extends VuexModule {
  propertiesAPI = main.propertiesAPI;

  notificationSource: EventSource | null = null;
  latestNotificationTime: number = 0;

  runningJobs: IComputeJob[] = [];

  @Mutation
  addJob(job: IComputeJob) {
    this.runningJobs = [...this.runningJobs, job];
  }

  @Mutation
  removeJob(jobId: string) {
    this.runningJobs = this.runningJobs.filter(
      (job: IComputeJob) => job.jobId !== jobId
    );
  }

  get isSubscribedToNotifications() {
    return !!this.notificationSource;
  }

  @Mutation
  setNotificationSource(source: EventSource | null) {
    this.notificationSource = source;
  }

  @Mutation
  setLatestNotificationTime(time: number) {
    this.latestNotificationTime = time;
  }

  @Action
  async handleJobEvent(event: MessageEvent) {
    let data: any;
    try {
      data = window.JSON.parse(event.data);
    } catch (error) {
      logError("Invalid event JSON");
      return;
    }
    const notificationTime = data._girderTime;
    if (notificationTime < this.latestNotificationTime) {
      return;
    }
    this.setLatestNotificationTime(notificationTime);

    const jobData = data.data;
    const status = jobData.status;
    if (
      ![jobStates.cancelled, jobStates.success, jobStates.error].includes(
        status
      )
    ) {
      return;
    }
    const [image] = jobData.args;
    const jobId = jobData._id;
    // if (this.previewJobIds[image] === jobId) { // TODO: callback
    //   this.setPreviewJobId({ image, id: null });
    //   this.fetchWorkerPreview(image);
    //   return;
    // }
    const jobTask = this.runningJobs.find(
      (job: IComputeJob) => job.jobId === jobData._id
    );
    if (jobTask) {
      const status = jobData.status;
      if (status === jobStates.success) {
        jobTask.callback(true);
      } else {
        jobTask.callback(false);
        logError(
          `Compute job with id ${jobTask.jobId} failed or was cancelled`
        );
      }
      this.removeJob(jobTask.jobId);
    }
  }
  @Action
  async initializeNotificationSubscription() {
    if (this.notificationSource) {
      this.closeNotificationSubscription();
    }
    const notificationSource: EventSource | null = this.propertiesAPI.subscribeToNotifications();
    if (notificationSource) {
      notificationSource.onmessage = this.handleJobEvent;
    }
  }

  @Action
  async closeNotificationSubscription() {
    if (this.notificationSource) {
      this.notificationSource.close();
      this.notificationSource = null;
    }
  }
}

export default getModule(Jobs);
