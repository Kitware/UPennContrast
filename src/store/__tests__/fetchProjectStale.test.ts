/**
 * fetchProject stale-response guard (PR #1414).
 *
 * Two refreshes of the same project can overlap (the Zenodo card refreshes
 * on a 409, on a job's terminal event and from its status poll). Without a
 * sequence guard, whichever resolves LAST commits, so an older snapshot
 * ("draft" from a finished upload) can replace a newer one ("uploading" from
 * the upload that followed). Imports the REAL projects store.
 */
import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({
  main: {
    isLoggedIn: true,
    projectsAPI: { getProject: vi.fn() },
  },
}));

vi.mock("@/store/index", () => ({ default: h.main }));
vi.mock("@/store/sync", () => ({ default: { setSaving: vi.fn() } }));
vi.mock("@/utils/log", () => ({ logError: vi.fn(), logWarning: vi.fn() }));

import projects from "@/store/projects";

function snapshot(status: string) {
  return {
    id: "p1",
    name: "Project",
    meta: { zenodo: { status } },
  } as any;
}

describe("fetchProject", () => {
  it("keeps the newest snapshot when refreshes resolve out of order", async () => {
    let resolveOlder!: (p: unknown) => void;
    h.main.projectsAPI.getProject
      .mockReturnValueOnce(new Promise((r) => (resolveOlder = r)))
      .mockResolvedValueOnce(snapshot("uploading"));

    const older = projects.fetchProject("p1");
    await projects.fetchProject("p1");
    resolveOlder(snapshot("draft"));
    await older;

    const stored = projects.projects.find((p) => p.id === "p1");
    expect(stored?.meta.zenodo?.status).toBe("uploading");
  });
});
