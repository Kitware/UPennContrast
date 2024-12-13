import {
  VuexModule,
  Module,
  Mutation,
  Action,
  getModule,
} from "vuex-module-decorators";
import store from "./root";
import main from "./index";
import jobs from "./jobs";
import { ProgressType, IProgress } from "./model";
import { jobStates } from "./jobs";
import { v4 as uuidv4 } from "uuid";

// These are the endpoints that are sent to the fetchAllJobs call. We can capture them to
// create appropriate progress items for them.
const ENDPOINT_MAPPINGS: Record<string, { type: ProgressType; title: string }> =
  {
    upenn_annotation: {
      type: ProgressType.ANNOTATION_FETCH,
      title: "Fetching Annotations", // TODO: If we decide that this will always be the same for all progresses of this type, we can remove this title and just use the default
    },
    annotation_connection: {
      type: ProgressType.CONNECTION_FETCH,
      title: "Fetching Connections",
    },
    // TODO: Remove this once because I don't think we need to track it.
    dataset_view: {
      type: ProgressType.VIEW_FETCH,
      title: "Fetching Dataset View",
    },
    // Can add other endpoint mappings as needed
  };

@Module({ dynamic: true, store, name: "progress" })
class Progress extends VuexModule {
  items: IProgress[] = [];

  @Mutation
  private ADD_PROGRESS(progress: IProgress) {
    this.items.push(progress);
  }

  @Mutation
  private UPDATE_PROGRESS({
    id,
    progress,
    total,
  }: {
    id: string;
    progress: number;
    total: number;
  }) {
    const item = this.items.find((p) => p.id === id);
    if (item) {
      item.progress = progress;
      item.total = total;
    }
  }

  @Mutation
  private REMOVE_PROGRESS(id: string) {
    this.items = this.items.filter((p) => p.id !== id);
  }

  @Action
  create(payload: {
    type?: ProgressType;
    endpoint?: string;
    title?: string;
    metadata?: Record<string, any>;
  }) {
    const id = uuidv4();
    let type: ProgressType;
    let title: string;

    if (payload.title) {
      // If title is provided, use it directly with a default type
      type = payload.type || ProgressType.GENERIC;
      title = payload.title;
    } else if (payload.endpoint) {
      // If endpoint is provided, look up the mapping
      const mapping = ENDPOINT_MAPPINGS[payload.endpoint];
      if (!mapping) {
        type = ProgressType.GENERIC;
        title = `Fetching ${payload.endpoint}`;
      } else {
        type = mapping.type;
        title = mapping.title;
      }
    } else if (payload.type) {
      // If only type is provided, use a default title for that type
      type = payload.type;
      switch (type) {
        case ProgressType.ANNOTATION_FETCH:
          title = "Fetching Annotations";
          break;
        case ProgressType.CONNECTION_FETCH:
          title = "Fetching Connections";
          break;
        case ProgressType.VIEW_FETCH:
          title = "Fetching Dataset View";
          break;
        case ProgressType.HISTOGRAM_CACHE:
          title = "Computing Histograms";
          break;
        case ProgressType.HISTOGRAM_SCHEDULE:
          title = "Scheduling Histogram Cache";
          break;
        default:
          title = "Operation in Progress";
      }
    } else {
      // Fallback
      type = ProgressType.GENERIC;
      title = "Operation in Progress";
    }

    this.ADD_PROGRESS({
      id,
      type,
      progress: 0,
      total: 0,
      title,
      metadata: payload.metadata || {},
    });
    return id;
  }

  @Action
  async trackHistogramJob(jobId: string) {
    const progressId = await this.create({
      type: ProgressType.HISTOGRAM_CACHE,
      title: "Computing histograms",
    });

    const datasetId = main.dataset?.id;
    if (!datasetId) {
      return;
    }

    const totalFrames = main.dataset
      ? main.dataset.z.length *
        main.dataset.time.length *
        main.dataset.xy.length *
        main.dataset.channels.length
      : 0;

    await jobs.addJob({
      jobId,
      datasetId,
      eventCallback: (jobInfo) => {
        // Check for completion first
        if (
          [jobStates.success, jobStates.error].includes(jobInfo.status || 0)
        ) {
          this.complete(progressId);
          return;
        }

        // If we have text with a frame number, treat it as progress
        // Note that the jobStates.running only comes on the first "running"
        // progress update, so we can't just use that to determine if we're
        // still running.
        const frameMatch = jobInfo.text?.match(/{'frame': (\d+)/);
        if (frameMatch) {
          const currentFrame = parseInt(frameMatch[1]);
          this.update({
            id: progressId,
            progress: currentFrame + 1,
            total: totalFrames,
          });
        }
      },
    });
  }

  @Action
  update(payload: { id: string; progress: number; total: number }) {
    this.UPDATE_PROGRESS(payload);
  }

  @Action
  complete(id: string) {
    this.REMOVE_PROGRESS(id);
  }

  get activeProgresses() {
    return this.items;
  }

  get hasActiveProgresses() {
    return this.items.length > 0;
  }
}

export default getModule(Progress);
