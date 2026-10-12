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

vi.mock("@/store/jobs", () => ({
  default: { addJob: vi.fn() },
}));

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
    mocks.uploadProject.mockRejectedValueOnce(
      serverError(400, "No Zenodo token configured."),
    );
    mocks.uploadProject.mockReturnValueOnce(new Promise(() => {}));
    const w = await mountComponent();

    await clickButton(w, "Upload to Zenodo");
    expect(requestError(w).exists()).toBe(true);

    w.findComponent({ name: "ZenodoTokenDialog" }).vm.$emit("saved");
    await flushPromises();
    expect(requestError(w).exists()).toBe(false);

    (w.vm as any).showError = true;
    await flushPromises();
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
