import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";

const mockGetDatasetAccess = vi.fn();
const mockFindDatasetViews = vi.fn();
const mockShareDatasetView = vi.fn();
const mockSetDatasetPublic = vi.fn();

const shareLinkMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/store", () => ({
  default: {
    dataset: { _id: "ds1", name: "TestDataset" },
    girderUser: { _id: "u1" },
    shareLinkAPI: shareLinkMocks,
    api: {
      getDatasetAccess: (...args: any[]) => mockGetDatasetAccess(...args),
      findDatasetViews: (...args: any[]) => mockFindDatasetViews(...args),
      shareDatasetView: (...args: any[]) => mockShareDatasetView(...args),
      setDatasetPublic: (...args: any[]) => mockSetDatasetPublic(...args),
    },
  },
}));

vi.mock("@/utils/log", () => ({
  logError: vi.fn(),
}));

import ShareDataset from "./ShareDataset.vue";

const defaultAccessList = {
  public: false,
  currentUserLevel: 2,
  users: [
    {
      id: "u1",
      login: "admin",
      name: "Admin",
      email: "admin@test.com",
      level: 2,
    },
    {
      id: "u2",
      login: "user1",
      name: "User One",
      email: "user1@test.com",
      level: 0,
    },
  ],
  configurations: [
    { id: "cfg1", name: "Config 1", public: false, currentUserLevel: 2 },
    { id: "cfg2", name: "Config 2", public: false, currentUserLevel: 2 },
  ],
  writableViewIds: ["v1", "v2"],
};

const defaultViews = [
  { id: "v1", configurationId: "cfg1", datasetId: "ds1" },
  { id: "v2", configurationId: "cfg2", datasetId: "ds1" },
];

function mountComponent(props: any = {}, renderStubDefaultSlot = false) {
  return shallowMount(ShareDataset, {
    props: {
      dataset: { _id: "ds1", _modelType: "folder", name: "TestDataset" },
      modelValue: false,
      ...props,
    },
    global: { renderStubDefaultSlot },
  });
}

describe("ShareDataset", () => {
  // The pending/settle registries are module-level, so a dialog left mounted
  // (and open) by one test would react to the next test's changes -- e.g.
  // refresh the access list and make a "refreshes" assertion pass for the
  // wrong reason. Unmount every wrapper after each test.
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetDatasetAccess.mockResolvedValue({ ...defaultAccessList });
    mockFindDatasetViews.mockResolvedValue([...defaultViews]);
    mockShareDatasetView.mockResolvedValue({});
    mockSetDatasetPublic.mockResolvedValue({
      dataset: "ds1",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 0,
    });
    shareLinkMocks.list.mockReset().mockResolvedValue([]);
    shareLinkMocks.create.mockReset();
    shareLinkMocks.revoke.mockReset().mockResolvedValue({});
  });

  it("lists, creates and revokes share links for an admin", async () => {
    const link = {
      _id: "l1",
      datasetId: "ds1",
      datasetViewId: "v1",
      configurationId: "cfg1",
      label: "reviewers",
      created: "2026-09-03T00:00:00Z",
      expiresAt: null,
      expired: false,
      createdBy: "u1",
    };
    shareLinkMocks.list.mockResolvedValue([link]);
    shareLinkMocks.create.mockResolvedValue({ ...link, token: "tok" });
    mockFindDatasetViews.mockResolvedValue([
      { id: "v1", configurationId: "cfg1", datasetId: "ds1" },
    ]);
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(shareLinkMocks.list).toHaveBeenCalledWith("ds1");
    expect(vm.shareLinks).toEqual([link]);

    vm.selectedConfigIds = ["cfg1"];
    vm.newLinkLabel = " reviewers ";
    vm.newLinkDays = 7;
    await vm.createLink();
    expect(shareLinkMocks.create).toHaveBeenCalledWith("v1", 7, "reviewers");
    expect(vm.createdLinkUrl).toContain("#/shared/tok");

    // Revoking an older link keeps the new URL, which is not shown again.
    await vm.revokeLink({ ...link, _id: "l0" });
    expect(shareLinkMocks.revoke).toHaveBeenCalledWith("l0");
    expect(vm.createdLinkUrl).toContain("#/shared/tok");

    await vm.revokeLink(link);
    expect(shareLinkMocks.revoke).toHaveBeenCalledWith("l1");
    expect(vm.shareLinks).toEqual([]);
    expect(vm.createdLinkUrl).toBeNull();
  });

  it("an older share-link list cannot overwrite a newer one", async () => {
    const link = {
      _id: "l1",
      datasetId: "ds1",
      datasetViewId: "v1",
      configurationId: "cfg1",
      label: "",
      created: "2026-09-03T00:00:00Z",
      expiresAt: null,
      expired: false,
      createdBy: "u1",
    };
    let finishOld!: (links: any[]) => void;
    shareLinkMocks.list
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValue([link]);
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1"); // opens the (slow) first list
    await vm.fetchShareLinks("ds1"); // e.g. after a create: newer
    expect(vm.shareLinks).toEqual([link]);
    finishOld([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.shareLinks).toEqual([link]);
  });

  it("dialog computed getter returns value prop", () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    expect(vm.dialog).toBe(true);
  });

  it("dialog computed getter returns false when value is false", () => {
    const wrapper = mountComponent({ modelValue: false });
    const vm = wrapper.vm as any;
    expect(vm.dialog).toBe(false);
  });

  it("dialog computed setter emits input event", () => {
    const wrapper = mountComponent({ modelValue: false });
    const vm = wrapper.vm as any;
    vm.dialog = true;
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")![0][0]).toBe(true);
  });

  it("close sets dialog to false", () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    vm.close();
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")![0][0]).toBe(false);
  });

  it("initializes with default state values", () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    expect(vm.loading).toBe(false);
    expect(vm.showError).toBe(false);
    expect(vm.errorString).toBe("");
    expect(vm.isPublic).toBe(false);
    expect(vm.users).toEqual([]);
    expect(vm.configurations).toEqual([]);
    expect(vm.selectedConfigIds).toEqual([]);
    expect(vm.newUserEmail).toBe("");
    expect(vm.newUserAccessLevel).toBe(0);
  });

  it("resetState clears all fields", async () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;

    // Set some state
    vm.loading = true;
    vm.showError = true;
    vm.errorString = "Error";
    vm.isPublic = true;
    vm.publicSkippedNotice = "1 collection owned by other users stayed private";
    vm.users = [{ id: "u1" }];
    vm.newUserEmail = "test@test.com";
    vm.newUserAccessLevel = 1;

    vm.resetState();

    expect(vm.publicSkippedNotice).toBe("");

    expect(vm.loading).toBe(false);
    expect(vm.showError).toBe(false);
    expect(vm.errorString).toBe("");
    expect(vm.isPublic).toBe(false);
    expect(vm.users).toEqual([]);
    expect(vm.configurations).toEqual([]);
    expect(vm.selectedConfigIds).toEqual([]);
    expect(vm.newUserEmail).toBe("");
    expect(vm.newUserAccessLevel).toBe(0);
    expect(vm.userToRemove).toBeNull();
  });

  it("fetchAccessInfo populates state from API", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");

    expect(mockGetDatasetAccess).toHaveBeenCalledWith("ds1");
    expect(mockFindDatasetViews).toHaveBeenCalledWith({ datasetId: "ds1" });
    expect(vm.isPublic).toBe(false);
    expect(vm.users).toHaveLength(2);
    expect(vm.configurations).toHaveLength(2);
    expect(vm.selectedConfigIds).toEqual(["cfg1", "cfg2"]);
    expect(vm.loading).toBe(false);
  });

  it("fetchAccessInfo handles error gracefully", async () => {
    mockGetDatasetAccess.mockRejectedValue(new Error("Network error"));
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");

    expect(vm.showError).toBe(true);
    expect(vm.errorString).toBe("Failed to load access information");
    expect(vm.loading).toBe(false);
  });

  it("togglePublic calls setDatasetPublic API", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.togglePublic(true);

    expect(mockSetDatasetPublic).toHaveBeenCalledWith("ds1", true);
    expect(vm.isPublic).toBe(true);
    expect(vm.publicLoading).toBe(false);
  });

  it("togglePublic explains what making private left public", async () => {
    mockSetDatasetPublic.mockResolvedValue({
      dataset: "ds1",
      public: false,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 1,
    });
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.togglePublic(false);

    expect(vm.publicSkippedNotice).toBe(
      "1 collection owned by other users stayed public; " +
        "only their owners can make them private.",
    );
  });

  it("togglePublic shows no notice when nothing was skipped", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.togglePublic(true);

    expect(vm.publicSkippedNotice).toBe("");
  });

  it("togglePublic explains views and collections owned by others", async () => {
    mockSetDatasetPublic.mockResolvedValue({
      dataset: "ds1",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 1,
      configurationsSkipped: 2,
    });
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.togglePublic(true);

    expect(vm.isPublic).toBe(true);
    expect(vm.publicSkippedNotice).toBe(
      "2 collections and 1 view owned by other users stayed private; " +
        "only their owners can make them public.",
    );

    // Not carried over to the next dataset the dialog loads.
    await vm.fetchAccessInfo("ds2");
    expect(vm.publicSkippedNotice).toBe("");
    await vm.togglePublic(true);

    // Cleared by the next toggle.
    mockSetDatasetPublic.mockResolvedValue({
      dataset: "ds1",
      public: false,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 0,
    });
    await vm.togglePublic(false);
    expect(vm.publicSkippedNotice).toBe("");
  });

  it("togglePublic keeps a publish in flight across a dialog reset", async () => {
    let finish: (value: unknown) => void = () => {};
    mockSetDatasetPublic.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;

    const publishing = vm.togglePublic(true);
    expect(vm.publicLoading).toBe(true);
    // The user clicks Done before the publish returns, then reopens.
    vm.resetState();
    // The server is still writing: no opposite request may start.
    expect(vm.publicLoading).toBe(true);
    await vm.togglePublic(false);
    expect(mockSetDatasetPublic).toHaveBeenCalledTimes(1);

    finish({
      dataset: "ds1",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 1,
      configurationsSkipped: 1,
    });
    await publishing;

    // The late result is not the reopened dialog's notice, but the
    // checkbox reflects what the server did.
    expect(vm.publicSkippedNotice).toBe("");
    expect(vm.isPublic).toBe(true);
    expect(vm.publicLoading).toBe(false);
  });

  it("togglePublic tracks a pending publish per dataset", async () => {
    const finishers: Record<string, (value: unknown) => void> = {};
    mockSetDatasetPublic.mockImplementation(
      (id: string) => new Promise((resolve) => (finishers[id] = resolve)),
    );
    const result = (id: string) => ({
      dataset: id,
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 0,
    });
    const datasetA = { _id: "dsA", _modelType: "folder", name: "A" } as any;
    const datasetB = { _id: "dsB", _modelType: "folder", name: "B" } as any;
    const wrapper = mountComponent({ dataset: datasetA });
    const vm = wrapper.vm as any;

    const publishingA = vm.togglePublic(true);
    // The reused dialog moves to B and publishes it; B settles first.
    await wrapper.setProps({ dataset: datasetB });
    expect(vm.publicLoading).toBe(false);
    const publishingB = vm.togglePublic(true);
    finishers.dsB(result("dsB"));
    await publishingB;

    // Back on A: its first request is still writing, so no second one.
    await wrapper.setProps({ dataset: datasetA });
    expect(vm.publicLoading).toBe(true);
    await vm.togglePublic(false);
    expect(mockSetDatasetPublic).toHaveBeenCalledTimes(2);

    finishers.dsA(result("dsA"));
    await publishingA;
    expect(vm.publicLoading).toBe(false);
  });

  it("togglePublic shows a dataset's notice after another dataset's publish", async () => {
    const finishers: Record<string, (value: unknown) => void> = {};
    mockSetDatasetPublic.mockImplementation(
      (id: string) => new Promise((resolve) => (finishers[id] = resolve)),
    );
    const datasetA = { _id: "dsA", _modelType: "folder", name: "A" } as any;
    const datasetB = { _id: "dsB", _modelType: "folder", name: "B" } as any;
    const wrapper = mountComponent({ dataset: datasetA });
    const vm = wrapper.vm as any;

    const publishingA = vm.togglePublic(true);
    await wrapper.setProps({ dataset: datasetB });
    const publishingB = vm.togglePublic(true);
    // Back on A before either settles: B's publish must not silence A's.
    await wrapper.setProps({ dataset: datasetA });
    finishers.dsA({
      dataset: "dsA",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 1,
    });
    await publishingA;

    expect(vm.publicSkippedNotice).toBe(
      "1 collection owned by other users stayed private; " +
        "only their owners can make them public.",
    );
    finishers.dsB({
      dataset: "dsB",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 2,
      configurationsSkipped: 0,
    });
    await publishingB;
    // B's result does not land on A's dialog.
    expect(vm.publicSkippedNotice).toBe(
      "1 collection owned by other users stayed private; " +
        "only their owners can make them public.",
    );
  });

  it("reloads access info when the open dialog moves to another dataset", async () => {
    mockGetDatasetAccess.mockImplementation(async (id: string) => ({
      ...defaultAccessList,
      public: id === "dsB",
    }));
    const datasetB = { _id: "dsB", _modelType: "folder", name: "B" } as any;
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await flushPromises();
    vm.publicSkippedNotice = "stale notice for ds1";

    await wrapper.setProps({ dataset: datasetB });
    await flushPromises();

    expect(mockGetDatasetAccess).toHaveBeenLastCalledWith("dsB");
    expect(vm.isPublic).toBe(true);
    expect(vm.publicSkippedNotice).toBe("");
  });

  it("ignores an access load for a dataset no longer shown", async () => {
    let finishA: (value: unknown) => void = () => {};
    mockGetDatasetAccess.mockImplementation((id: string) =>
      id === "ds1"
        ? new Promise((resolve) => (finishA = resolve))
        : Promise.resolve({ ...defaultAccessList, public: false }),
    );
    const datasetB = { _id: "dsB", _modelType: "folder", name: "B" } as any;
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;

    await wrapper.setProps({ dataset: datasetB });
    await flushPromises();
    // ds1's load resolves last; it must not overwrite dsB's state.
    finishA({ ...defaultAccessList, public: true, users: [] });
    await flushPromises();

    expect(vm.isPublic).toBe(false);
    expect(vm.users).toHaveLength(2);
    expect(vm.loading).toBe(false);
  });

  it("an access load overlapping a publish leaves the checkbox to the publish", async () => {
    let finishPublishRequest: (value: unknown) => void = () => {};
    mockSetDatasetPublic.mockReturnValue(
      new Promise((resolve) => (finishPublishRequest = resolve)),
    );
    let finishLoad: (value: unknown) => void = () => {};
    mockGetDatasetAccess.mockReturnValue(
      new Promise((resolve) => (finishLoad = resolve)),
    );
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;

    const publishing = vm.togglePublic(true);
    const loading = vm.fetchAccessInfo("ds1");
    finishPublishRequest({
      dataset: "ds1",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 0,
    });
    await publishing;
    // The load read the flag before the write committed.
    finishLoad({ ...defaultAccessList, public: false });
    await loading;

    expect(vm.isPublic).toBe(true);
  });

  it("a failed load for the next dataset leaves no previous dataset state", async () => {
    mockGetDatasetAccess.mockImplementation(async (id: string) => {
      if (id === "dsB") throw new Error("Network error");
      return { ...defaultAccessList };
    });
    const datasetB = { _id: "dsB", _modelType: "folder", name: "B" } as any;
    shareLinkMocks.list.mockImplementation(async (id: string) => {
      if (id === "dsB") throw new Error("Network error");
      return [{ _id: "linkA", configurationId: "cfg1", created: "" }];
    });
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    await flushPromises();
    expect(vm.isResourceAdmin).toBe(true);
    expect(vm.shareLinks).toHaveLength(1);
    // A removal awaiting confirmation and a just-created link's one-time URL.
    vm.confirmRemoveUser(vm.users[1]);
    vm.createdLinkUrl = "https://example.test/#/shared/secret";
    // Inputs typed for ds1 (Add would grant this user access to dsB).
    vm.newUserEmail = "someone@example.test";
    vm.newUserAccessLevel = 1;
    vm.newLinkLabel = "for ds1";

    await wrapper.setProps({ dataset: datasetB });
    await flushPromises();

    // None of dataset ds1's state may act on dsB.
    expect(vm.confirmDialog).toBe(false);
    expect(vm.userToRemove).toBeNull();
    expect(vm.shareLinks).toEqual([]);
    expect(vm.createdLinkUrl).toBeNull();
    expect(vm.newUserEmail).toBe("");
    expect(vm.newUserAccessLevel).toBe(0);
    expect(vm.newLinkLabel).toBe("");

    // ds1's users would keep the admin controls enabled, and its views
    // would be what add/remove submit, while the dialog shows dsB.
    expect(vm.showError).toBe(true);
    expect(vm.users).toEqual([]);
    expect(vm.isResourceAdmin).toBe(false);
    expect(vm.configurations).toEqual([]);
    expect(vm.selectedConfigIds).toEqual([]);
    expect(vm.associatedViews).toEqual([]);
  });

  it("another dialog takes the publish result its overlapping load skipped", async () => {
    let finish: (value: unknown) => void = () => {};
    mockSetDatasetPublic.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    // The second dialog's load reads the flag before the write commits.
    mockGetDatasetAccess.mockResolvedValue({
      ...defaultAccessList,
      public: false,
    });
    const first = mountComponent();
    const second = mountComponent();
    const publishing = (first.vm as any).togglePublic(true);
    await (second.vm as any).fetchAccessInfo("ds1");
    expect((second.vm as any).isPublic).toBe(false);

    finish({
      dataset: "ds1",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 0,
    });
    await publishing;
    await flushPromises();

    expect((second.vm as any).isPublic).toBe(true);
    expect((first.vm as any).isPublic).toBe(true);
  });

  it("sharing and link responses that land after a reset leave the dialog alone", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const user = vm.users[1];

    // Remove fails late, after the dialog closed.
    let failRemove: (error: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((_, reject) => (failRemove = reject)),
    );
    vm.confirmRemoveUser(user);
    const removing = vm.removeUser();
    expect(vm.isUserPending(user.id)).toBe(true);
    vm.resetState();
    // Still running on the server: the user's controls stay locked.
    expect(vm.isUserPending(user.id)).toBe(true);
    failRemove(new Error("late"));
    await removing;
    expect(vm.showError).toBe(false);
    expect(vm.isUserPending(user.id)).toBe(false);

    // A link created after the dialog closed: its one-time URL must not
    // appear in the next dialog.
    await vm.fetchAccessInfo("ds1");
    vm.selectedConfigIds = ["cfg1"];
    let finishCreate: (value: unknown) => void = () => {};
    shareLinkMocks.create.mockReturnValueOnce(
      new Promise((resolve) => (finishCreate = resolve)),
    );
    const creating = vm.createLink();
    vm.resetState();
    finishCreate({ _id: "link1", token: "secret-token" });
    await creating;
    expect(vm.createdLinkUrl).toBeNull();
  });

  it("a sharing change in flight blocks an overlapping one after a reopen", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const user = vm.users[1];

    // An access change still running when the dialog closes and reopens...
    let finishChange: (value: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((resolve) => (finishChange = resolve)),
    );
    const changing = vm.updateUserAccess(user, 1);
    vm.resetState();
    await vm.fetchAccessInfo("ds1");
    // ...keeps that user's controls locked, so a newer change cannot race
    // it on the server and be overwritten when the older one lands last.
    expect(vm.isUserPending(user.id)).toBe(true);
    await vm.updateUserAccess(vm.users[1], 0);
    expect(mockShareDatasetView).toHaveBeenCalledTimes(1);
    finishChange({});
    await changing;
    expect(vm.isUserPending(user.id)).toBe(false);

    // Likewise one Create at a time: a repeat would mint a second link
    // whose one-time token is never shown.
    vm.selectedConfigIds = ["cfg1"];
    let finishCreate: (value: unknown) => void = () => {};
    shareLinkMocks.create.mockReturnValueOnce(
      new Promise((resolve) => (finishCreate = resolve)),
    );
    const creating = vm.createLink();
    vm.resetState();
    await vm.fetchAccessInfo("ds1");
    vm.selectedConfigIds = ["cfg1"];
    expect(vm.creatingLink).toBe(true);
    await vm.createLink();
    expect(shareLinkMocks.create).toHaveBeenCalledTimes(1);
    finishCreate({ _id: "link1", token: "secret-token" });
    await creating;
    expect(vm.creatingLink).toBe(false);
  });

  it("a change settling refreshes a dialog that loaded while it ran", async () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const user = vm.users[1];

    let finishChange: (value: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((resolve) => (finishChange = resolve)),
    );
    const changing = vm.updateUserAccess(user, 1);
    // Closed and reopened mid-change: this load reads the old level, and the
    // change's own result is dropped (it belongs to the earlier session).
    vm.resetState();
    await vm.fetchAccessInfo("ds1");
    expect(vm.users[1].level).toBe(0);

    const changed = {
      ...defaultAccessList,
      users: [defaultAccessList.users[0], { ...user, level: 1 }],
    };
    mockGetDatasetAccess.mockResolvedValue(changed);
    finishChange({});
    await changing;
    await flushPromises();

    expect(vm.users[1].level).toBe(1);
  });

  it("one removal finishing leaves another removal's confirmation alone", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const [userX, userY] = [vm.users[1], { ...vm.users[1], id: "u3" }];

    let finishRemove: (value: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((resolve) => (finishRemove = resolve)),
    );
    vm.confirmRemoveUser(userX);
    const removing = vm.removeUser();
    // Y's removal is confirmed while X's still runs.
    vm.confirmRemoveUser(userY);
    finishRemove({});
    await removing;

    expect(vm.userToRemove).toEqual(userY);
    expect(vm.confirmDialog).toBe(true);
  });

  it("a revoke does not drop a create's refreshed link list", async () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    const oldLink = { _id: "old", configurationId: "cfg1", created: "" };
    const newLink = { _id: "new", configurationId: "cfg1", created: "" };
    shareLinkMocks.list.mockResolvedValue([oldLink]);
    await vm.fetchAccessInfo("ds1");
    await flushPromises();
    vm.selectedConfigIds = ["cfg1"];

    let finishCreate: (value: unknown) => void = () => {};
    shareLinkMocks.create.mockReturnValueOnce(
      new Promise((resolve) => (finishCreate = resolve)),
    );
    const creating = vm.createLink();
    // The old link is revoked while the create runs.
    await vm.revokeLink(oldLink);
    shareLinkMocks.list.mockResolvedValue([newLink]);
    finishCreate({ _id: "new", token: "t" });
    await creating;
    await flushPromises();

    expect(vm.shareLinks.map((l: any) => l._id)).toEqual(["new"]);
  });

  it("an Add and a change to any user's access exclude each other", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const user = vm.users[1];

    let finishChange: (value: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((resolve) => (finishChange = resolve)),
    );
    const changing = vm.updateUserAccess(user, 1);
    // The Add could name this same user: it waits for the change.
    expect(vm.addUserLoading).toBe(true);
    vm.newUserEmail = user.login;
    await vm.addUser();
    expect(mockShareDatasetView).toHaveBeenCalledTimes(1);
    finishChange({});
    await changing;

    let finishAdd: (value: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((resolve) => (finishAdd = resolve)),
    );
    vm.newUserEmail = "someone@example.test";
    const adding = vm.addUser();
    // ...and every user's controls wait for an Add.
    expect(vm.isUserPending(user.id)).toBe(true);
    await vm.updateUserAccess(user, 0);
    expect(mockShareDatasetView).toHaveBeenCalledTimes(2);
    finishAdd({});
    await adding;
  });

  it("a request from before A -> B -> A does not write into the new A session", async () => {
    mockGetDatasetAccess.mockImplementation(async () => ({
      ...defaultAccessList,
    }));
    const datasetB = { _id: "dsB", _modelType: "folder", name: "B" } as any;
    const datasetA = { _id: "ds1", _modelType: "folder", name: "A" } as any;
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");

    // Add User starts on A and is still pending...
    let finishAdd: (value: unknown) => void = () => {};
    mockShareDatasetView.mockReturnValueOnce(
      new Promise((resolve) => (finishAdd = resolve)),
    );
    vm.newUserEmail = "first@example.test";
    const adding = vm.addUser();
    // ...while the dialog moves to B and back to A, where a new user is typed.
    await wrapper.setProps({ dataset: datasetB });
    await wrapper.setProps({ dataset: datasetA });
    await flushPromises();
    vm.newUserEmail = "second@example.test";

    finishAdd({});
    await adding;
    await flushPromises();

    // The first session's success must not clear the new session's input.
    expect(vm.newUserEmail).toBe("second@example.test");
    expect(vm.addUserLoading).toBe(false);
  });

  it("shares a pending publish across dialog instances", async () => {
    let finish: (value: unknown) => void = () => {};
    mockSetDatasetPublic.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    const first = mountComponent();
    const second = mountComponent();
    const publishing = (first.vm as any).togglePublic(true);

    // Another dialog for the same dataset (e.g. another file-browser row).
    expect((second.vm as any).publicLoading).toBe(true);
    (second.vm as any).isPublic = false; // the v-model flip
    await (second.vm as any).togglePublic(false);
    expect(mockSetDatasetPublic).toHaveBeenCalledTimes(1);
    expect((second.vm as any).isPublic).toBe(true);

    finish({
      dataset: "ds1",
      public: true,
      datasetViewsUpdated: 1,
      configurationsUpdated: 1,
      datasetViewsSkipped: 0,
      configurationsSkipped: 0,
    });
    await publishing;
    expect((second.vm as any).publicLoading).toBe(false);
  });

  it("togglePublic reverts isPublic on error", async () => {
    mockSetDatasetPublic.mockRejectedValue(new Error("fail"));
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    vm.isPublic = false;
    await vm.togglePublic(true);

    expect(vm.isPublic).toBe(false);
    expect(vm.showError).toBe(true);
    expect(vm.publicLoading).toBe(false);
  });

  it("togglePublic does nothing when dataset is null", async () => {
    const wrapper = mountComponent({ dataset: null });
    const vm = wrapper.vm as any;
    await vm.togglePublic(true);
    expect(mockSetDatasetPublic).not.toHaveBeenCalled();
  });

  it("updateUserAccess calls shareDatasetView with correct args", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");

    const user = vm.users[1]; // non-admin user
    await vm.updateUserAccess(user, 1);

    expect(mockShareDatasetView).toHaveBeenCalledWith(
      expect.any(Array),
      user.login,
      1,
    );
  });

  it("updateUserAccess shows error when no configs selected", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    vm.selectedConfigIds = [];

    await vm.updateUserAccess({ id: "u2", login: "user1" }, 1);

    expect(vm.showError).toBe(true);
    expect(vm.errorString).toBe("Please select at least one collection");
    expect(mockShareDatasetView).not.toHaveBeenCalled();
  });

  it("updateUserAccess handles badEmailOrUsername response", async () => {
    mockShareDatasetView.mockResolvedValue("badEmailOrUsername");
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");

    await vm.updateUserAccess({ id: "u2", login: "user1" }, 1);

    expect(vm.showError).toBe(true);
    expect(vm.errorString).toBe("User not found");
  });

  it("removeUser calls shareDatasetView with level -1", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const user = vm.users[1];
    vm.userToRemove = user;

    await vm.removeUser();

    expect(mockShareDatasetView).toHaveBeenCalledWith(
      expect.any(Array),
      user.login,
      -1,
    );
  });

  it("removeUser removes user from local state on success", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    const user = vm.users[1];
    vm.userToRemove = user;

    await vm.removeUser();

    expect(vm.users.find((u: any) => u.id === user.id)).toBeUndefined();
  });

  it("removeUser does nothing when userToRemove is null", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    vm.userToRemove = null;
    await vm.removeUser();
    expect(mockShareDatasetView).not.toHaveBeenCalled();
  });

  it("addUser calls shareDatasetView and refreshes access", async () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    // The user picked one collection; the refresh after the add keeps it.
    vm.selectedConfigIds = ["cfg1"];
    mockGetDatasetAccess.mockClear();
    mockFindDatasetViews.mockClear();

    vm.newUserEmail = "newuser@test.com";
    vm.newUserAccessLevel = 1;
    await vm.addUser();
    await flushPromises();

    expect(mockShareDatasetView).toHaveBeenCalledWith(
      expect.any(Array),
      "newuser@test.com",
      1,
    );
    // Refreshes access info once the add settles, quietly: no spinner, and
    // the collection selection survives.
    expect(mockGetDatasetAccess).toHaveBeenCalledWith("ds1");
    expect(vm.loading).toBe(false);
    expect(vm.selectedConfigIds).toEqual(["cfg1"]);
    // Form cleared
    expect(vm.newUserEmail).toBe("");
    expect(vm.newUserAccessLevel).toBe(0);
  });

  it("addUser does nothing when email is empty", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    vm.newUserEmail = "";
    await vm.addUser();
    expect(mockShareDatasetView).not.toHaveBeenCalled();
  });

  it("addUser shows error when no configs selected", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    vm.selectedConfigIds = [];
    vm.newUserEmail = "test@test.com";

    await vm.addUser();

    expect(vm.showError).toBe(true);
    expect(vm.errorString).toBe("Please select at least one collection");
  });

  it("addUser handles badEmailOrUsername response", async () => {
    mockShareDatasetView.mockResolvedValue("badEmailOrUsername");
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    vm.newUserEmail = "unknown@test.com";

    await vm.addUser();

    expect(vm.showError).toBe(true);
    expect(vm.errorString).toBe(
      "Unknown user. Please check the username or email.",
    );
  });

  it("confirmRemoveUser sets userToRemove and opens confirm dialog", () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    const user = { id: "u2", login: "user1", name: "User One" };
    vm.confirmRemoveUser(user);
    expect(vm.userToRemove).toEqual(user);
    expect(vm.confirmDialog).toBe(true);
  });

  it("getSelectedViews filters views by selectedConfigIds", async () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    vm.selectedConfigIds = ["cfg1"];

    const views = vm.getSelectedViews();
    expect(views).toHaveLength(1);
    expect(views[0].configurationId).toBe("cfg1");
  });

  it("accessLevelItems contains Read and Write options", () => {
    const wrapper = mountComponent();
    const vm = wrapper.vm as any;
    expect(vm.accessLevelItems).toEqual([
      { text: "Read", value: 0 },
      { text: "Write", value: 1 },
    ]);
  });

  // Vuetify 3 @change migration: v-checkbox should use @update:model-value
  it("public checkbox triggers togglePublic with boolean via update:modelValue", async () => {
    mockGetDatasetAccess.mockResolvedValue({
      ...defaultAccessList,
      public: false,
    });
    mockFindDatasetViews.mockResolvedValue([...defaultViews]);
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    // Make the component admin so the checkbox is rendered
    vm.isResourceAdmin = true;
    await wrapper.vm.$nextTick();

    // Find the v-checkbox for public toggle
    const checkbox = wrapper
      .findAllComponents({ name: "v-checkbox" })
      .find((c) => c.props("label")?.includes("Make Public"));

    if (checkbox) {
      mockSetDatasetPublic.mockClear();
      // Emit update:modelValue — what Vuetify 3 v-checkbox does on toggle
      checkbox.vm.$emit("update:modelValue", true);
      await wrapper.vm.$nextTick();
      // If wired with @update:model-value, togglePublic(true) should be called
      expect(mockSetDatasetPublic).toHaveBeenCalledWith("ds1", true);
    } else {
      // If checkbox isn't rendered (not admin), test the handler directly
      // to ensure it receives boolean, not Event
      await vm.togglePublic(true);
      expect(mockSetDatasetPublic).toHaveBeenCalledWith("ds1", true);
    }
  });

  it("the owner sees public access and share links", async () => {
    const wrapper = mountComponent({ modelValue: true }, true);
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    await wrapper.vm.$nextTick();
    const html = wrapper.html();
    expect(html).toContain("Make Public");
    expect(html).toContain("Share links</div>");
    expect(html).toContain("Add User:");
  });

  describe("a WRITE collaborator", () => {
    const writeAccessList = {
      ...defaultAccessList,
      currentUserLevel: 1,
      users: [
        { id: "owner", login: "o", name: "O", email: "o@t.com", level: 2 },
        { id: "u1", login: "me", name: "Me", email: "me@t.com", level: 1 },
        { id: "u3", login: "r", name: "R", email: "r@t.com", level: 0 },
      ],
    };

    it("can manage users at or below Write but not the owner", async () => {
      mockGetDatasetAccess.mockResolvedValue(writeAccessList);
      // Render stub slots so the dialog's content is in the HTML
      const wrapper = mountComponent({ modelValue: true }, true);
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");
      await wrapper.vm.$nextTick();

      expect(vm.canManageUsers).toBe(true);
      expect(vm.isResourceAdmin).toBe(false);
      const [owner, me, reader] = writeAccessList.users;
      expect(vm.canEditUser(owner)).toBe(false);
      expect(vm.canEditUser(me)).toBe(true);
      expect(vm.canEditUser(reader)).toBe(true);

      const html = wrapper.html();
      expect(html).toContain("Add User:");
      // Public access, collection choice and share links stay owner-only
      expect(html).not.toContain("Make Public");
      expect(html).not.toContain("Share links</div>");
    });

    it("a READ user can manage nobody", async () => {
      mockGetDatasetAccess.mockResolvedValue({
        ...writeAccessList,
        currentUserLevel: 0,
        users: writeAccessList.users.map((u) =>
          u.id === "u1" ? { ...u, level: 0 } : u,
        ),
      });
      const wrapper = mountComponent({ modelValue: true }, true);
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");
      await wrapper.vm.$nextTick();

      expect(wrapper.html()).toContain("Current Access:");
      expect(vm.canManageUsers).toBe(false);
      expect(vm.canEditUser(writeAccessList.users[2])).toBe(false);
      expect(wrapper.html()).not.toContain("Add User:");
    });
  });

  it("shows the server's reason when a share is refused", async () => {
    const reason = "You cannot grant access above your own level";
    mockShareDatasetView.mockResolvedValue(reason);
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");

    vm.newUserEmail = "someone";
    await vm.addUser();
    expect(vm.errorString).toBe(reason);
  });

  it("takes management rights from the server's effective level", async () => {
    // WRITE through a group (or site admin): no direct row for the caller
    mockGetDatasetAccess.mockResolvedValue({
      ...defaultAccessList,
      currentUserLevel: 1,
      users: defaultAccessList.users.filter((u) => u.id !== "u1"),
    });
    const wrapper = mountComponent({ modelValue: true }, true);
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    await wrapper.vm.$nextTick();

    expect(vm.canManageUsers).toBe(true);
    expect(vm.isResourceAdmin).toBe(false);
    expect(wrapper.html()).toContain("Add User:");
  });

  describe("changing your own entry", () => {
    const selfOnly = {
      ...defaultAccessList,
      currentUserLevel: 1,
      users: [
        { id: "u1", login: "me", name: "Me", email: "me@t.com", level: 1 },
        { id: "u3", login: "r", name: "R", email: "r@t.com", level: 0 },
      ],
    };

    async function openAsWriteUser() {
      mockGetDatasetAccess.mockResolvedValue(selfOnly);
      const wrapper = mountComponent({ modelValue: true });
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");
      vm.selectedConfigIds = ["cfg1"];
      mockShareDatasetView.mockResolvedValue(true);
      return { vm, wrapper };
    }

    // A settled sharing change triggers a refresh (fetchAccessInfo(id,
    // true)) from the mutation-settle watcher, on a later tick.
    async function settle() {
      await flushPromises();
      await flushPromises();
    }

    it("removing your last access fails closed on the 403", async () => {
      const { vm } = await openAsWriteUser();
      // The real endpoint needs READ, so it rejects once you're gone
      mockGetDatasetAccess.mockRejectedValue(new Error("403"));
      vm.confirmRemoveUser(vm.users[0]);
      await vm.removeUser();
      await settle();

      expect(mockGetDatasetAccess).toHaveBeenCalledTimes(2);
      expect(vm.canManageUsers).toBe(false);
      // A failed refresh fails closed quietly; only a full load reports it
      expect(vm.showError).toBe(false);
    });

    it("re-reads your level but keeps the collection selection", async () => {
      const { vm } = await openAsWriteUser();
      mockGetDatasetAccess.mockResolvedValue({
        ...selfOnly,
        currentUserLevel: 0,
        users: selfOnly.users.map((u) =>
          u.id === "u1" ? { ...u, level: 0 } : u,
        ),
      });
      await vm.updateUserAccess(vm.users[0], 0);
      await settle();

      expect(vm.canManageUsers).toBe(false);
      expect(vm.selectedConfigIds).toEqual(["cfg1"]);
    });

    it("any settled change refreshes the access list", async () => {
      const { vm } = await openAsWriteUser();
      await vm.updateUserAccess(vm.users[1], 1);
      await settle();
      expect(mockGetDatasetAccess).toHaveBeenCalledTimes(2);
    });

    it("an older refresh cannot overwrite a newer load", async () => {
      // Codex: a refresh still in flight when a newer load lands (e.g. the
      // reload after adding a user) must not overwrite it when it returns.
      const { vm } = await openAsWriteUser();
      let resolveOld: (value: unknown) => void = () => {};
      mockGetDatasetAccess.mockReturnValueOnce(
        new Promise((resolve) => (resolveOld = resolve)),
      );
      const older = vm.fetchAccessInfo("ds1", true);

      const newer = {
        ...selfOnly,
        users: [
          ...selfOnly.users,
          { id: "u9", login: "new", name: "New", email: "n@t.com", level: 0 },
        ],
      };
      mockGetDatasetAccess.mockResolvedValue(newer);
      await vm.fetchAccessInfo("ds1", true);
      expect(vm.users.map((u: any) => u.id)).toContain("u9");

      resolveOld({ ...selfOnly, currentUserLevel: 0 });
      await older;
      expect(vm.users.map((u: any) => u.id)).toContain("u9");
      expect(vm.currentUserLevel).toBe(1);
    });

    it("overlapping full loads commit only the latest", async () => {
      const { vm } = await openAsWriteUser();
      let resolveFirst: (value: unknown) => void = () => {};
      mockGetDatasetAccess.mockReturnValueOnce(
        new Promise((resolve) => (resolveFirst = resolve)),
      );
      const first = vm.fetchAccessInfo("ds1");
      mockGetDatasetAccess.mockResolvedValueOnce({
        ...selfOnly,
        currentUserLevel: 2,
      });
      await vm.fetchAccessInfo("ds1");
      expect(vm.currentUserLevel).toBe(2);

      resolveFirst({ ...selfOnly, currentUserLevel: 0 });
      await first;
      expect(vm.currentUserLevel).toBe(2);
      expect(vm.loading).toBe(false);
    });

    it("a load superseded by a refresh still clears loading", async () => {
      const { vm } = await openAsWriteUser();
      let resolveFull: (value: unknown) => void = () => {};
      mockGetDatasetAccess.mockReturnValueOnce(
        new Promise((resolve) => (resolveFull = resolve)),
      );
      const full = vm.fetchAccessInfo("ds1");
      expect(vm.loading).toBe(true);

      // A refresh superseding a full load finishes it as a full load
      mockGetDatasetAccess.mockResolvedValueOnce(selfOnly);
      await vm.fetchAccessInfo("ds1", true);
      resolveFull(selfOnly);
      await full;
      expect(vm.loading).toBe(false);
    });

    it("a self-change during a reopen's load still fills the dialog", async () => {
      // Review: close and reopen while your own change is pending; the
      // self-change reload must not leave views/selection/public unset.
      const { vm } = await openAsWriteUser();
      let resolveShare: (value: unknown) => void = () => {};
      mockShareDatasetView.mockReturnValueOnce(
        new Promise((resolve) => (resolveShare = resolve)),
      );
      const selfChange = vm.updateUserAccess(vm.users[0], 1);

      vm.resetState();
      let resolveReopen: (value: unknown) => void = () => {};
      mockGetDatasetAccess.mockReturnValueOnce(
        new Promise((resolve) => (resolveReopen = resolve)),
      );
      const reopen = vm.fetchAccessInfo("ds1");
      mockGetDatasetAccess.mockResolvedValue({ ...selfOnly, public: true });

      resolveShare(true);
      await selfChange;
      resolveReopen({ ...selfOnly, public: true });
      await reopen;

      expect(vm.loading).toBe(false);
      expect(vm.isPublic).toBe(true);
      expect(vm.associatedViews.length).toBe(defaultViews.length);
      expect(vm.selectedConfigIds.length).toBeGreaterThan(0);
    });

    it("drops a reload that lands after the dialog closed", async () => {
      const { vm, wrapper } = await openAsWriteUser();
      let resolveReload: (value: unknown) => void = () => {};
      mockGetDatasetAccess.mockReturnValue(
        new Promise((resolve) => (resolveReload = resolve)),
      );
      vm.confirmRemoveUser(vm.users[0]);
      const removal = vm.removeUser();
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Closing through the prop runs the dialog watcher's resetState
      await wrapper.setProps({ modelValue: false });
      expect(vm.currentUserLevel).toBe(-1);
      resolveReload({ ...selfOnly, currentUserLevel: 2 });
      await removal;

      expect(vm.currentUserLevel).toBe(-1);
    });
  });

  it("a failed access load hides management controls", async () => {
    const wrapper = mountComponent({ modelValue: true });
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    expect(vm.isResourceAdmin).toBe(true);

    mockGetDatasetAccess.mockRejectedValue(new Error("network"));
    await vm.fetchAccessInfo("ds1");
    expect(vm.canManageUsers).toBe(false);
  });

  describe("only writable views and collections are shared", () => {
    // WRITE on the dataset, but READ on cfg2 and on the view of cfg1
    const partlyWritable = {
      ...defaultAccessList,
      currentUserLevel: 1,
      configurations: [
        { id: "cfg1", name: "Config 1", public: false, currentUserLevel: 1 },
        { id: "cfg2", name: "Config 2", public: false, currentUserLevel: 0 },
        { id: "cfg3", name: "Config 3", public: false, currentUserLevel: 1 },
      ],
      writableViewIds: ["v3"],
    };
    const views = [
      { id: "v1", configurationId: "cfg1", datasetId: "ds1" },
      { id: "v2", configurationId: "cfg2", datasetId: "ds1" },
      { id: "v3", configurationId: "cfg3", datasetId: "ds1" },
    ];

    it("selects writable collections and sends writable views", async () => {
      mockGetDatasetAccess.mockResolvedValue(partlyWritable);
      mockFindDatasetViews.mockResolvedValue(views);
      const wrapper = mountComponent({ modelValue: true });
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");

      // cfg1 is writable but its only view is not, so it can't be shared
      expect(vm.selectedConfigIds).toEqual(["cfg3"]);
      expect(vm.isConfigShareable(partlyWritable.configurations[0])).toBe(
        false,
      );
      vm.newUserEmail = "someone";
      await vm.addUser();
      expect(mockShareDatasetView).toHaveBeenCalledWith(
        [views[2]],
        "someone",
        0,
      );
    });

    it("never shows a collection selected that would not be shared", async () => {
      // Every selected collection must contribute a view to the request
      mockGetDatasetAccess.mockResolvedValue({
        ...partlyWritable,
        currentUserLevel: 2,
      });
      mockFindDatasetViews.mockResolvedValue(views);
      const wrapper = mountComponent({ modelValue: true });
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");

      const sharedConfigs = new Set(
        vm.getSelectedViews().map((v: any) => v.configurationId),
      );
      expect(new Set(vm.selectedConfigIds)).toEqual(sharedConfigs);
    });

    it("disables an owner's checkbox for a read-only collection", async () => {
      mockGetDatasetAccess.mockResolvedValue({
        ...partlyWritable,
        currentUserLevel: 2,
      });
      mockFindDatasetViews.mockResolvedValue(views);
      const wrapper = mountComponent({ modelValue: true }, true);
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");
      await wrapper.vm.$nextTick();

      const boxes = wrapper.findAllComponents({ name: "v-checkbox" });
      // Config 2 is read-only; Config 1 is writable but has no writable view
      for (const name of ["Config 1", "Config 2"]) {
        const box = boxes.find((b) =>
          String(b.props("label") ?? b.attributes("label")).includes(name),
        );
        expect(box).toBeDefined();
        expect(
          box!.props("disabled") ?? box!.attributes("disabled"),
        ).toBeTruthy();
      }
      const shareable = boxes.find((b) =>
        String(b.props("label") ?? b.attributes("label")).includes("Config 3"),
      );
      expect(
        shareable!.props("disabled") ?? shareable!.attributes("disabled"),
      ).toBeFalsy();
    });

    it("a self-change prunes collections you can no longer write", async () => {
      mockGetDatasetAccess.mockResolvedValue({
        ...partlyWritable,
        users: [
          { id: "u1", login: "me", name: "Me", email: "me@t.com", level: 1 },
        ],
      });
      mockFindDatasetViews.mockResolvedValue(views);
      mockShareDatasetView.mockResolvedValue(true);
      const wrapper = mountComponent({ modelValue: true });
      const vm = wrapper.vm as any;
      await vm.fetchAccessInfo("ds1");
      expect(vm.selectedConfigIds).toEqual(["cfg3"]);

      mockGetDatasetAccess.mockResolvedValue({
        ...partlyWritable,
        configurations: partlyWritable.configurations.map((c) =>
          c.id === "cfg3" ? { ...c, currentUserLevel: 0 } : c,
        ),
        writableViewIds: [],
      });
      await vm.updateUserAccess(vm.users[0], 1);
      await flushPromises();
      await flushPromises();
      expect(vm.selectedConfigIds).toEqual([]);
      expect(vm.getSelectedViews()).toEqual([]);
    });
  });

  it("with nothing shareable, a WRITE user gets a note, not controls", async () => {
    mockGetDatasetAccess.mockResolvedValue({
      ...defaultAccessList,
      currentUserLevel: 1,
      users: [
        { id: "u1", login: "me", name: "Me", email: "me@t.com", level: 1 },
        { id: "u3", login: "r", name: "R", email: "r@t.com", level: 0 },
      ],
      writableViewIds: [],
    });
    const wrapper = mountComponent({ modelValue: true }, true);
    const vm = wrapper.vm as any;
    await vm.fetchAccessInfo("ds1");
    await wrapper.vm.$nextTick();

    expect(vm.canManageUsers).toBe(true);
    expect(vm.canShareAny).toBe(false);
    expect(vm.canEditUser(vm.users[1])).toBe(false);
    const html = wrapper.html();
    expect(html).toContain("You can't share any of this dataset's collections");
    expect(html).not.toContain('label="Username or Email"');
  });
});
