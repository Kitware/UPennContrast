import {
  getModule,
  Action,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import store from "./root";
import Vue from "vue";

import { IComputeJob, IJobEventData, IProgressInfo } from "./model";

import main from "./index";

import { logError } from "@/utils/log";

export const jobStates = {
  inactive: 0,
  queued: 1,
  running: 2,
  success: 3,
  error: 4,
  cancelled: 5,
  cancelling: 824
};

// Create a function that can be used as eventCallback of a job
// It will parse the events and update the progress object
export function createProgressEventCallback(progressObject: IProgressInfo) {
  return (jobData: IJobEventData) => {
    const text = jobData.text;
    if (!text || typeof text !== "string") {
      return;
    }
    for (const line of text.split("\n")) {
      if (!line) {
        continue;
      }
      try {
        const progress = JSON.parse(line);
        // The only required property is "progress"
        if (typeof progress.progress === "number") {
          for (const [k, v] of Object.entries(progress)) {
            Vue.set(progressObject, k, v);
          }
        }
      } catch {}
    }
  };
}

@Module({ dynamic: true, store, name: "jobs" })
export class Jobs extends VuexModule {
  notificationSource: EventSource | null = null;
  latestNotificationTime: number = 0;

  runningJobs: IComputeJob[] = [];

  connectionErrors: number = 0;

  @Mutation
  rawAddJob(job: IComputeJob) {
    this.runningJobs = [...this.runningJobs, job];
  }

  @Action
  async addJob(job: IComputeJob) {
    if (!this.notificationSource) {
      await this.initializeNotificationSubscription();
    }
    this.rawAddJob(job);
  }

  @Mutation
  rawRemoveJob(jobId: string) {
    this.runningJobs = this.runningJobs.filter(
      (job: IComputeJob) => job.jobId !== jobId
    );
  }

  @Action
  async removeJob(jobId: string) {
    this.rawRemoveJob(jobId);
    if (this.runningJobs.length <= 0) {
      await this.closeNotificationSubscription();
    }
    // A job is done, add badge to annotation panel if it is closed
    if (!main.isAnnotationPanelOpen) {
      main.setAnnotationPanelBadge(true);
    }
  }

  @Mutation
  setNotificationSource(source: EventSource | null) {
    this.notificationSource = source;
  }

  @Mutation
  setLatestNotificationTime(time: number) {
    this.latestNotificationTime = time;
  }

  @Mutation
  setConnectionErrors(value: number) {
    this.connectionErrors = value;
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
    const jobTasks = this.runningJobs.filter(job => job.jobId === jobData._id);
    for (const task of jobTasks) {
      task.eventCallback?.(jobData);
    }
    const status = jobData.status;
    if (
      ![jobStates.cancelled, jobStates.success, jobStates.error].includes(
        status
      )
    ) {
      return;
    }

    const success = status === jobStates.success;
    if (!success) {
      logError(
        `Compute job with id ${jobData._id} ${
          status === jobStates.cancelled ? "cancelled" : "failed"
        }`
      );
    }
    this.removeJob(jobData._id);
    for (const jobTask of jobTasks) {
      jobTask.callback(success);
    }
  }

  @Action
  async handleError() {
    this.setConnectionErrors(this.connectionErrors + 1);
    if (this.connectionErrors <= 3) {
      await this.initializeNotificationSubscription();
    } else {
      // Can't connect after 3 attempts
      logError("Can't connect to girder notification stream");
      await this.closeNotificationSubscription();
    }
  }

  @Action
  async handleOpen() {
    this.setConnectionErrors(0);
  }

  @Action
  async initializeNotificationSubscription() {
    await this.closeNotificationSubscription();
    const notificationSource = new EventSource(
      `${main.girderRest.apiRoot}/notification/stream?token=${main.girderRest.token}`
    );
    notificationSource.onmessage = this.handleJobEvent;
    notificationSource.onerror = this.handleError;
    notificationSource.onopen = this.handleOpen;
    this.setNotificationSource(notificationSource);
  }

  @Action
  async closeNotificationSubscription() {
    if (this.notificationSource) {
      this.notificationSource.close();
      this.setNotificationSource(null);
    }
  }
}

export default getModule(Jobs);
