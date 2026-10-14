import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";

const mockSetProjectPublic = vi.fn();
const mockGetProjectAccess = vi.fn();

vi.mock("@/store", () => ({
  default: {
    projectsAPI: {
      setProjectPublic: (...args: any[]) => mockSetProjectPublic(...args),
      getProjectAccess: (...args: any[]) => mockGetProjectAccess(...args),
    },
  },
}));

vi.mock("@/utils/log", () => ({
  logError: vi.fn(),
}));

import ShareProject from "./ShareProject.vue";

function mountComponent(meta: any = { datasets: [], collections: [] }) {
  return shallowMount(ShareProject, {
    props: {
      project: { id: "p1", name: "Project", meta } as any,
      modelValue: false,
    },
  });
}

describe("ShareProject", () => {
  beforeEach(() => {
    mockSetProjectPublic.mockReset();
    mockGetProjectAccess.mockReset();
  });

  it("reports contained resources set_public left unchanged", async () => {
    mockSetProjectPublic.mockResolvedValue({
      projectId: "p1",
      public: true,
      skipped: 2,
    });
    const vm = mountComponent().vm as any;

    await vm.togglePublic(true);

    expect(vm.isPublic).toBe(true);
    expect(vm.noticeString).toContain("2 datasets, collections or views");
    expect(vm.noticeString).toContain("you don't own");
  });

  it("words the notice for a single skipped resource", async () => {
    mockSetProjectPublic.mockResolvedValue({
      projectId: "p1",
      public: true,
      skipped: 1,
    });
    const vm = mountComponent().vm as any;

    await vm.togglePublic(true);

    expect(vm.noticeString).toContain("1 dataset, collection or view");
    expect(vm.noticeString).toContain("kept its own visibility");
  });

  it("shows no notice when set_public changed everything", async () => {
    mockSetProjectPublic.mockResolvedValue({
      projectId: "p1",
      public: false,
      skipped: 0,
    });
    const vm = mountComponent().vm as any;
    vm.noticeString = "stale notice";

    await vm.togglePublic(false);

    expect(vm.isPublic).toBe(false);
    expect(vm.noticeString).toBe("");
  });

  it("does not claim every project resource is affected", () => {
    const vm = mountComponent({
      datasets: [{ datasetId: "d1" }, { datasetId: "d2" }],
      collections: [{ collectionId: "c1" }],
    }).vm as any;

    expect(vm.impactSummary).toContain("2 datasets and 1 collection");
    expect(vm.impactSummary).toContain("Sharing changes the ones you can edit");
    expect(vm.impactSummary).toContain("refused if it would grant more");
    expect(vm.impactSummary).not.toContain("all associated");
    // Publishing skips configurations of owned datasets the caller only edits
    expect(vm.impactSummary).toContain("publishing changes only what you own");
  });

  it("shows the server's reason when a share is refused", () => {
    const vm = mountComponent().vm as any;
    const refusal = (message: string) => ({
      isAxiosError: true,
      response: { data: { message } },
    });

    expect(
      vm.shareErrorMessage(
        refusal("You cannot grant access above your own level"),
      ),
    ).toBe("You cannot grant access above your own level");
    expect(vm.shareErrorMessage(refusal("badEmailOrUsername"))).toBe(
      "Unknown user. Please check the username or email.",
    );
    expect(vm.shareErrorMessage(new Error("network"))).toBe(
      "An error occurred while updating sharing",
    );
  });
});
