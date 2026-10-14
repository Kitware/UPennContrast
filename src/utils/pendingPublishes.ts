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

// The public state each dataset's last publish left it in (the requested
// value on success, the previous one on failure). Every dialog showing the
// dataset takes it when the publish settles, including dialogs whose own
// access load was skipped because it overlapped the publish.
const settledValues = new Map<string, boolean>();

export function isPublishPending(datasetId: string): boolean {
  return pending.has(datasetId);
}

export function startPublish(datasetId: string) {
  pending.add(datasetId);
}

export function finishPublish(datasetId: string, publicValue: boolean) {
  settledValues.set(datasetId, publicValue);
  settled.set(datasetId, publishSettleCount(datasetId) + 1);
  // Last: removing it is what notifies watchers of isPublishPending.
  pending.delete(datasetId);
}

export function publishSettleCount(datasetId: string): number {
  return settled.get(datasetId) ?? 0;
}

export function settledPublicValue(datasetId: string): boolean | undefined {
  return settledValues.get(datasetId);
}
