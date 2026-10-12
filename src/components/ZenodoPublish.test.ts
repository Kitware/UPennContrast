import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  getCredentials: vi.fn(),
  uploadProject: vi.fn(),
  publishProject: vi.fn(),
  discardDraft: vi.fn(),
  findActiveUploadJob: vi.fn(),
}));

vi.mock("@/store", () => ({
  default: { zenodoAPI: mocks },
}));

vi.mock("@/store/jobs", () => ({
  default: { addJob: vi.fn() },
}));

vi.mock("@/utils/log", () => ({ logError: vi.fn() }));

import ZenodoPublish from "./ZenodoPublish.vue";

function serverError(status: number, message: string) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    response: { status, data: { message, type: "rest" } },
  });
}

function project(status?: string) {
  return {
    id: "p1",
    name: "Project",
    meta: status ? { zenodo: { status } } : {},
  } as any;
}

let wrapper: VueWrapper | null = null;

function mountComponent(status?: string) {
  wrapper = mount(ZenodoPublish, {
    props: { project: project(status) },
    global: { stubs: { ZenodoTokenDialog: true } },
    attachTo: document.body,
  });
  return wrapper;
}

describe("ZenodoPublish", () => {
  beforeEach(() => {
    mocks.getCredentials.mockResolvedValue({ hasToken: true, sandbox: false });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it("shows the server's message when the upload is refused", async () => {
    mocks.uploadProject.mockRejectedValue(
      serverError(
        400,
        "Project has 120 files, exceeding Zenodo's 100-file limit.",
      ),
    );
    const w = mountComponent();
    await flushPromises();

    await w.find("button.v-btn--variant-flat").trigger("click");
    await flushPromises();

    const alert = w.find('[data-testid="zenodo-request-error"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain(
      "Project has 120 files, exceeding Zenodo's 100-file limit.",
    );
    expect(alert.text()).not.toContain("owner access");
    // Upload button comes back so the user can retry after fixing it.
    expect(w.text()).toContain("Upload to Zenodo");
  });

  it("explains owner access when the upload is refused with 403", async () => {
    mocks.uploadProject.mockRejectedValue(
      serverError(403, "Admin access denied for folder abc (user u1)."),
    );
    const w = mountComponent();
    await flushPromises();

    await w.find("button.v-btn--variant-flat").trigger("click");
    await flushPromises();

    const text = w.find('[data-testid="zenodo-request-error"]').text();
    expect(text).toContain("Admin access denied for folder abc (user u1).");
    expect(text).not.toContain("..");
    expect(text).toContain(
      "requires owner access to every dataset and collection in the project",
    );
  });

  it("shows the server's message in the publish dialog", async () => {
    mocks.publishProject.mockRejectedValue(
      serverError(403, "Admin access denied for collection c1 (user u1)."),
    );
    const w = mountComponent("draft");
    await flushPromises();

    const publishButton = w
      .findAll("button")
      .find((b) => b.text().includes("Publish (Mint DOI)"))!;
    await publishButton.trigger("click");
    await flushPromises();

    const confirm = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Publish",
    )!;
    confirm.click();
    await flushPromises();

    const alert = document.body.querySelector(
      '[data-testid="zenodo-publish-error"]',
    );
    expect(alert?.textContent).toContain(
      "Admin access denied for collection c1 (user u1).",
    );
    expect(alert?.textContent).toContain("requires owner access");
    // Dialog stays open on failure.
    expect((w.vm as any).confirmPublish).toBe(true);
  });
});
