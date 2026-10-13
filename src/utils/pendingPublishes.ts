import { reactive } from "vue";

// Datasets with a POST dataset_view/set_public in flight, shared by every
// ShareDataset instance (one is mounted per file-browser row, another by
// DatasetInfo). The server keeps writing after a dialog closes or unmounts,
// so a second dialog for the same dataset must not start an opposite request
// until the first settles.
const pending = reactive(new Set<string>());

// How many publishes have settled per dataset. An access-list fetch that
// overlapped one of them read the public flag mid-write, so it must not
// overwrite the checkbox the publish already set.
const settled = new Map<string, number>();

export function isPublishPending(datasetId: string): boolean {
  return pending.has(datasetId);
}

export function startPublish(datasetId: string) {
  pending.add(datasetId);
}

export function finishPublish(datasetId: string) {
  pending.delete(datasetId);
  settled.set(datasetId, publishSettleCount(datasetId) + 1);
}

export function publishSettleCount(datasetId: string): number {
  return settled.get(datasetId) ?? 0;
}
