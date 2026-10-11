import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import RecentDatasets from "./RecentDatasets.vue";
import type { IRecentDatasetViewItem } from "@/store/model";
import { formatDateNumber } from "@/utils/date";

const sampleItems = [
  {
    datasetView: { id: "dv1", lastViewed: 1700000000000 },
    datasetInfo: { name: "Dataset A", description: "Desc A", creatorId: "u1" },
    configInfo: { name: "Config 1", description: "Conf Desc" },
  },
  {
    datasetView: { id: "dv2", lastViewed: 1700001000000 },
    datasetInfo: { name: "Dataset B", description: "", creatorId: "" },
    configInfo: { name: "Config 2", description: "" },
  },
] as unknown as IRecentDatasetViewItem[];

function mountComponent(props = {}) {
  return mount(RecentDatasets, {
    props: {
      datasetViewItems: sampleItems,
      getUserDisplayName: vi.fn((id: string) => `User ${id} (u-${id}@x)`),
      getUserShortName: vi.fn((id: string) => `User ${id}`),
      formatDateNumber: vi.fn((d?: number) =>
        new Date(d ?? 0).toLocaleString(),
      ),
      ...props,
    },
  });
}

describe("RecentDatasets", () => {
  it("renders dataset items", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Dataset A");
    expect(wrapper.text()).toContain("Dataset B");
  });

  it("renders configuration names", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("Config 1");
    expect(wrapper.text()).toContain("Config 2");
  });

  it("calls getUserShortName for items with creatorId", () => {
    const getUserShortName = vi.fn(() => "Test User");
    mountComponent({ getUserShortName });
    expect(getUserShortName).toHaveBeenCalledWith("u1");
  });

  it("emits dataset-clicked when a dataset is clicked", async () => {
    const wrapper = mountComponent();
    const listItems = wrapper.findAll(".recent-item");
    await listItems.at(0)!.trigger("click");
    expect(wrapper.emitted("dataset-clicked")).toBeTruthy();
    expect(wrapper.emitted("dataset-clicked")![0]).toEqual(["dv1"]);
  });

  it("renders every item when a view has no lastViewed", () => {
    // Views created through the REST API (not the app) can lack lastViewed;
    // date-fns used to throw during render and blank the whole list.
    const items = [
      {
        datasetView: { id: "dv3" },
        datasetInfo: { name: "API Dataset", description: "", creatorId: "" },
        configInfo: { name: "API Config", description: "" },
      },
      ...sampleItems,
    ] as unknown as IRecentDatasetViewItem[];
    const wrapper = mountComponent({
      datasetViewItems: items,
      formatDateNumber,
    });
    const rows = wrapper.findAll(".recent-item");
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain("API Dataset");
    expect(rows[0].find(".recent-item__date").text()).toBe("");
    expect(rows[0].find(".recent-item__time").text()).toBe("");
    expect(rows[0].attributes("title")).toBeUndefined();
    expect(rows[1].find(".recent-item__date").text()).not.toBe("");
    expect(rows[1].attributes("title")).toBeTruthy();
  });
});
