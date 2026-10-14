import { reactive } from "vue";

// Sharing changes in flight on the server, keyed by what they change. Shared
// by every ShareDataset instance and kept across dialog sessions: the request
// keeps running after its dialog closes, reopens or unmounts, so the guard
// that stops a second, overlapping change (an older access change finishing
// last and overwriting a newer one, a repeated Create minting duplicate
// links) has to outlive the dialog too. Publishing has its own record in
// utils/pendingPublishes, which also carries each publish's result.
const pending = reactive(new Set<string>());

// How many sharing changes have settled per dataset. Every dialog showing
// the dataset refreshes when this moves, so one that loaded while a change
// was in flight (or dropped its result) does not keep stale rows.
const settled = reactive(new Map<string, number>());

export const mutationKeys = {
  // Changing or removing one user's access to a dataset.
  user: (datasetId: string, userId: string) => `user:${datasetId}:${userId}`,
  // Adding a user, named by login/email: it can target any user of the
  // dataset, so it excludes (and is excluded by) every user change.
  addUser: (datasetId: string) => `addUser:${datasetId}`,
  createLink: (datasetId: string) => `createLink:${datasetId}`,
  revokeLink: (linkId: string) => `revokeLink:${linkId}`,
};

export function isMutationPending(key: string): boolean {
  return pending.has(key);
}

/** Any change to a user's access to the dataset (add, change, remove). */
export function isUserMutationPending(datasetId: string): boolean {
  const prefix = `user:${datasetId}:`;
  if (pending.has(mutationKeys.addUser(datasetId))) {
    return true;
  }
  for (const key of pending) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

export function startMutation(key: string) {
  pending.add(key);
}

export function finishMutation(key: string, datasetId: string) {
  pending.delete(key);
  settled.set(datasetId, mutationSettleCount(datasetId) + 1);
}

export function mutationSettleCount(datasetId: string): number {
  return settled.get(datasetId) ?? 0;
}
