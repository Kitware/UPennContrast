import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { AxiosError, AxiosHeaders } from "axios";

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

const jobsMock = vi.hoisted(() => ({ addJob: vi.fn() }));
vi.mock("@/store/jobs", () => ({ default: jobsMock }));

vi.mock("@/utils/log", () => ({ logError: vi.fn() }));

import ZenodoPublish from "./ZenodoPublish.vue";

const OWNER_HINT =
  "requires owner access to every dataset and collection in the project";

// A real AxiosError, so the component's isAxiosError() check sees what the
// Girder client actually throws.
function serverError(status: number, message: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    config,
    {},
    {
      status,
      statusText: "",
      headers: {},
      config,
      data: { message, type: status === 403 ? "access" : "rest" },
    },
  );
}

function project(status?: string) {
  return {
    id: "p1",
    name: "Project",
    meta: status ? { zenodo: { status } } : {},
  } as any;
}

let wrapper: VueWrapper | null = null;

async function mountComponent(status?: string) {
  wrapper = mount(ZenodoPublish, {
    props: { project: project(status) },
    global: { stubs: { ZenodoTokenDialog: true } },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

async function clickButton(w: VueWrapper, label: string) {
  const button = w.findAll("button").find((b) => b.text().includes(label));
  expect(button, `button "${label}"`).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}

function requestError(w: VueWrapper) {
  return w.find('[data-testid="zenodo-request-error"]');
}

describe("ZenodoPublish", () => {
  beforeEach(() => {
    mocks.getCredentials.mockResolvedValue({ hasToken: true, sandbox: false });
    mocks.findActiveUploadJob.mockResolvedValue({ _id: "job-1" });
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
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");

    const alert = requestError(w);
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain(
      "Project has 120 files, exceeding Zenodo's 100-file limit.",
    );
    expect(alert.text()).not.toContain(OWNER_HINT);
    // Upload button comes back so the user can retry after fixing it.
    expect(w.text()).toContain("Upload to Zenodo");
  });

  it("explains owner access when a dataset refuses the upload", async () => {
    mocks.uploadProject.mockRejectedValue(
      serverError(403, "Admin access denied for folder abc (user u1)."),
    );
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");

    const text = requestError(w).text();
    expect(text).toContain("Admin access denied for folder abc (user u1).");
    expect(text).not.toContain("..");
    expect(text).toContain(OWNER_HINT);
  });

  it("shows a project-level 403 without the dataset hint", async () => {
    mocks.uploadProject.mockRejectedValue(
      serverError(403, "Admin access denied for project p1 (user u1)."),
    );
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");

    const text = requestError(w).text();
    expect(text).toContain("Admin access denied for project p1 (user u1).");
    expect(text).not.toContain(OWNER_HINT);
  });

  it("shows a discard refusal without the publishing hint", async () => {
    mocks.discardDraft.mockRejectedValue(
      serverError(403, "Admin access denied for folder abc (user u1)."),
    );
    const w = await mountComponent("draft");

    await clickButton(w, "Discard Draft");

    const text = requestError(w).text();
    expect(text).toContain("Admin access denied for folder abc (user u1).");
    expect(text).not.toContain(OWNER_HINT);
  });

  it("clears the error on retry and after saving a token", async () => {
    mocks.uploadProject
      .mockRejectedValueOnce(serverError(400, "No Zenodo token configured."))
      .mockRejectedValueOnce(
        serverError(400, "Zenodo token validation failed."),
      )
      .mockReturnValueOnce(new Promise(() => {}));
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");
    expect(requestError(w).text()).toContain("No Zenodo token configured.");

    w.findComponent({ name: "ZenodoTokenDialog" }).vm.$emit("saved");
    await flushPromises();
    expect(requestError(w).exists()).toBe(false);

    await clickButton(w, "Upload to Zenodo");
    expect(requestError(w).text()).toContain("Zenodo token validation failed.");

    // A retry that is still in flight shows no old error.
    await clickButton(w, "Upload to Zenodo");
    expect(requestError(w).exists()).toBe(false);
  });

  it("refreshes the project when an upload is already in progress", async () => {
    mocks.uploadProject.mockRejectedValue(
      serverError(409, "An upload is already in progress for this project."),
    );
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");

    expect(requestError(w).text()).toContain(
      "An upload is already in progress for this project.",
    );
    expect(w.emitted("updated")).toHaveLength(1);

    // The refreshed project reports the other upload: follow its job, so
    // the card leaves "uploading" when that job ends.
    await w.setProps({ project: project("uploading") });
    await flushPromises();
    expect(mocks.findActiveUploadJob).toHaveBeenCalledWith("p1");
    expect(jobsMock.addJob).toHaveBeenCalledTimes(1);
    expect(jobsMock.addJob.mock.calls[0][0].jobId).toBe("job-1");
  });

  it("tracks an upload once, and again after it ends", async () => {
    mocks.uploadProject.mockResolvedValue({ jobId: "job-1", totalFiles: 3 });
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");
    expect(jobsMock.addJob).toHaveBeenCalledTimes(1);

    // The refresh this upload triggers must not subscribe a second time.
    await w.setProps({ project: project("uploading") });
    await flushPromises();
    expect(mocks.findActiveUploadJob).not.toHaveBeenCalled();
    expect(jobsMock.addJob).toHaveBeenCalledTimes(1);

    // The job ends; a later upload (from another tab) is followed again.
    jobsMock.addJob.mock.calls[0][0].eventCallback({ status: 3 });
    await w.setProps({ project: project("draft") });
    await w.setProps({ project: project("uploading") });
    await flushPromises();
    expect(mocks.findActiveUploadJob).toHaveBeenCalledTimes(1);
    expect(jobsMock.addJob).toHaveBeenCalledTimes(2);
  });

  it("re-reads the project when the reported upload has no job", async () => {
    // A cached project can still say "uploading" after its job ended (the
    // store doesn't refetch a cached project on navigation).
    mocks.findActiveUploadJob.mockResolvedValue(null);
    const w = await mountComponent("uploading");

    expect(jobsMock.addJob).not.toHaveBeenCalled();
    expect(w.emitted("updated")).toHaveLength(1);
  });

  it("can't discard while an upload is starting", async () => {
    mocks.uploadProject.mockReturnValue(new Promise(() => {}));
    const w = await mountComponent("error");

    await clickButton(w, "Upload to Zenodo");

    // Discard would overwrite the 'uploading' status the upload just set.
    const discard = w
      .findAll("button")
      .find((b) => b.text().includes("Discard Draft"))!;
    expect(discard.attributes("disabled")).toBeDefined();
  });

  it("follows an upload already running when it mounts", async () => {
    await mountComponent("uploading");
    expect(mocks.findActiveUploadJob).toHaveBeenCalledTimes(1);
    expect(jobsMock.addJob).toHaveBeenCalledTimes(1);
  });

  it("keeps each request's error in its own place", async () => {
    mocks.uploadProject.mockRejectedValue(
      serverError(400, "No Zenodo token configured."),
    );
    let rejectDiscard!: (e: unknown) => void;
    mocks.discardDraft.mockReturnValue(
      new Promise((_, reject) => (rejectDiscard = reject)),
    );
    const w = await mountComponent("error");

    await clickButton(w, "Upload to Zenodo");
    await clickButton(w, "Discard Draft");
    rejectDiscard(serverError(500, "Discard failed."));
    await flushPromises();

    // Starting the discard did not hide the upload's error.
    const texts = w
      .findAll('[data-testid="zenodo-request-error"]')
      .map((a) => a.text());
    expect(texts).toEqual([
      expect.stringContaining("No Zenodo token configured."),
      expect.stringContaining("Discard failed."),
    ]);
  });

  it("does not let publish and discard overlap", async () => {
    mocks.discardDraft.mockReturnValue(new Promise(() => {}));
    mocks.publishProject.mockReturnValue(new Promise(() => {}));
    const w = await mountComponent("draft");
    const mintButton = () =>
      w.findAll("button").find((b) => b.text().includes("Publish (Mint DOI)"))!;

    await clickButton(w, "Discard Draft");
    // A discard in flight would make the publish dialog's error belong to
    // discard, and could publish a draft that is being deleted.
    expect(mintButton().attributes("disabled")).toBeDefined();

    w.unmount();
    const w2 = await mountComponent("draft");
    await clickButton(w2, "Publish (Mint DOI)");
    Array.from(document.body.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Publish")!
      .click();
    await flushPromises();
    // Cancelling a pending publish would orphan its error.
    const cancel = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Cancel",
    )!;
    expect(cancel.disabled).toBe(true);
  });

  it("shows the server's message in the publish dialog", async () => {
    mocks.publishProject.mockRejectedValue(
      serverError(403, "Admin access denied for collection c1 (user u1)."),
    );
    const w = await mountComponent("draft");

    await clickButton(w, "Publish (Mint DOI)");

    // The dialog is teleported to <body>, outside the wrapper.
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
    expect(alert?.textContent).toContain(OWNER_HINT);
    // Dialog stays open on failure, and the card doesn't repeat the error.
    expect((w.vm as any).confirmPublish).toBe(true);
    expect(requestError(w).exists()).toBe(false);
  });
});
