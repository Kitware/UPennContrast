import { describe, it, expect, vi } from "vitest";

vi.mock("@/store", () => ({ default: {} }));
vi.mock("@/utils/log", () => ({ logError: vi.fn() }));

import ZenodoAPI from "./ZenodoAPI";
import { jobStates } from "./jobConstants";

describe("ZenodoAPI.findActiveUploadJob", () => {
  it("includes jobs not yet picked up by their thread", async () => {
    // createLocalJob + scheduleJob leave the job INACTIVE until the daemon
    // thread marks it RUNNING; a 409 in that window must still find it.
    const get = vi.fn().mockResolvedValue({
      data: [
        { _id: "other", kwargs: { projectId: "p2" } },
        { _id: "job-1", kwargs: { projectId: "p1" } },
      ],
    });
    const api = new ZenodoAPI({ get } as any);

    const job = await api.findActiveUploadJob("p1");

    expect(job?._id).toBe("job-1");
    const statuses = JSON.parse(get.mock.calls[0][1].params.statuses);
    expect(statuses).toEqual(
      expect.arrayContaining([
        jobStates.inactive,
        jobStates.queued,
        jobStates.running,
      ]),
    );
  });
});
