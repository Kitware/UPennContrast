<template>
  <v-dialog v-model="dialog" max-width="750px">
    <v-card>
      <v-card-title>
        {{ canManageUsers ? "Share Dataset:" : "Sharing:" }}
        {{ dataset ? dataset.name : "" }}
      </v-card-title>
      <v-card-text>
        <!-- Error Alert -->
        <v-alert
          v-model="showError"
          type="error"
          density="compact"
          closable
          class="mb-4"
        >
          {{ errorString }}
        </v-alert>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-4">
          <v-progress-circular indeterminate color="primary" />
          <div class="mt-2">Loading access information...</div>
        </div>

        <v-container v-else>
          <!-- Collections Selection (admin only) -->
          <v-row v-if="isResourceAdmin && configurations.length > 0">
            <v-col cols="12">
              <div class="subtitle-2 mb-2">
                Select collections to share along with dataset:
              </div>
              <v-checkbox
                v-for="config in configurations"
                :key="config.id"
                v-model="selectedConfigIds"
                :label="
                  isConfigShareable(config)
                    ? config.name
                    : `${config.name} (you can't share this one)`
                "
                :value="config.id"
                :disabled="!isConfigShareable(config)"
                :hide-details="true"
                density="compact"
              />
            </v-col>
          </v-row>

          <v-divider v-if="isResourceAdmin" class="my-4" />

          <!-- Public Access Toggle (admin only) -->
          <v-row v-if="isResourceAdmin">
            <v-col cols="12">
              <v-checkbox
                v-model="isPublic"
                label="Make Public (read-only access for everyone)"
                :loading="publicLoading"
                :disabled="publicLoading"
                hide-details
                density="compact"
                @update:model-value="togglePublic"
              />
              <v-alert
                v-if="publicSkippedNotice"
                type="info"
                density="compact"
                class="mt-2"
              >
                {{ publicSkippedNotice }}
              </v-alert>
            </v-col>
          </v-row>

          <!-- Public Status (read-only for non-admin) -->
          <v-row v-else>
            <v-col cols="12">
              <v-chip
                size="small"
                :color="isPublic ? 'green' : 'grey'"
                text-color="white"
              >
                <v-icon start size="small">
                  {{ isPublic ? "mdi-earth" : "mdi-lock" }}
                </v-icon>
                {{ isPublic ? "Public" : "Private" }}
              </v-chip>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <!-- Current Access List -->
          <v-row>
            <v-col cols="12">
              <div class="subtitle-2 mb-2">Current Access:</div>
              <div v-if="users.length === 0" class="text-body-2 text-grey">
                No users have been granted access yet.
              </div>
              <v-table v-else density="compact">
                <template #default>
                  <thead>
                    <tr>
                      <th class="text-left">User</th>
                      <th class="text-left" style="width: 150px">
                        Access Level
                      </th>
                      <th
                        v-if="canManageUsers"
                        class="text-center"
                        style="width: 80px"
                      >
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in users" :key="user.id">
                      <td class="text-left">
                        <div class="font-weight-medium">
                          {{ user.name || user.login }}
                        </div>
                        <div class="text-caption text-grey text-left">
                          {{ user.email || user.login }}
                        </div>
                      </td>
                      <td>
                        <span
                          v-if="user.level === 2"
                          class="font-weight-medium"
                        >
                          Admin (Owner)
                        </span>
                        <template v-else-if="canEditUser(user)">
                          <v-select
                            :model-value="user.level"
                            :items="accessLevelItems"
                            item-title="text"
                            item-value="value"
                            density="compact"
                            hide-details
                            :loading="isUserPending(user.id)"
                            :disabled="isUserPending(user.id)"
                            @update:model-value="updateUserAccess(user, $event)"
                          />
                        </template>
                        <span v-else class="font-weight-medium">
                          {{ accessLevelLabel(user.level) }}
                        </span>
                      </td>
                      <td v-if="canManageUsers" class="text-center">
                        <v-btn
                          v-if="canEditUser(user)"
                          variant="text"
                          icon
                          size="small"
                          color="error"
                          :loading="isUserPending(user.id)"
                          :disabled="isUserPending(user.id)"
                          @click="confirmRemoveUser(user)"
                        >
                          <v-icon size="small">mdi-close</v-icon>
                        </v-btn>
                        <v-tooltip v-else bottom>
                          <template #activator="{ props: activatorProps }">
                            <v-icon
                              size="small"
                              color="grey-lighten-1"
                              v-bind="activatorProps"
                            >
                              mdi-lock
                            </v-icon>
                          </template>
                          <span>{{
                            user.level === 2
                              ? "Cannot remove dataset owner"
                              : "Cannot change a user above your own access"
                          }}</span>
                        </v-tooltip>
                      </td>
                    </tr>
                  </tbody>
                </template>
              </v-table>
            </v-col>
          </v-row>

          <!-- Add User Form (WRITE or ADMIN; levels never exceed Write) -->
          <template v-if="canManageUsers">
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12">
                <div class="subtitle-2 mb-2">Add User:</div>
                <div v-if="!canShareAny" class="text-body-2 text-grey">
                  You can't share any of this dataset's collections: sharing
                  needs edit access to a collection and to one of its views.
                </div>
                <v-row v-else density="comfortable" align="center">
                  <v-col cols="5">
                    <v-text-field
                      v-model="newUserEmail"
                      label="Username or Email"
                      density="compact"
                      variant="outlined"
                      hide-details
                      :disabled="addUserLoading"
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-select
                      v-model="newUserAccessLevel"
                      :items="accessLevelItems"
                      item-title="text"
                      item-value="value"
                      label="Access"
                      density="compact"
                      variant="outlined"
                      hide-details
                      :disabled="addUserLoading"
                    />
                  </v-col>
                  <v-col cols="3">
                    <v-btn
                      variant="flat"
                      color="primary"
                      size="small"
                      :loading="addUserLoading"
                      :disabled="!newUserEmail || addUserLoading"
                      @click="addUser"
                    >
                      <v-icon start size="small">mdi-plus</v-icon>
                      Add
                    </v-btn>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </template>
          <!-- Share-view links (admin only): capability URLs that open one
               collection's view read-only, without making the dataset
               public. See SHARING.md "Share links". -->
          <template v-if="isResourceAdmin">
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12">
                <div class="subtitle-2 mb-1">Share links</div>
                <div class="text-caption text-medium-emphasis mb-2">
                  A link opens exactly one collection (select one above),
                  read-only, for anyone who has it — no sign-in needed; the
                  files themselves cannot be downloaded through it. Links can
                  expire and can be revoked here.
                </div>
                <v-table v-if="shareLinks.length > 0" density="compact">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Collection</th>
                      <th>Created</th>
                      <th>Expires</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="link in shareLinks" :key="link._id">
                      <td>{{ link.label || "—" }}</td>
                      <td>{{ configurationName(link.configurationId) }}</td>
                      <td>{{ formatDate(link.created) }}</td>
                      <td>
                        {{
                          link.expiresAt
                            ? formatDate(link.expiresAt) +
                              (link.expired ? " (expired)" : "")
                            : "never"
                        }}
                      </td>
                      <td class="text-right">
                        <v-btn
                          size="x-small"
                          variant="text"
                          color="error"
                          :loading="isRevoking(link._id)"
                          :disabled="isRevoking(link._id)"
                          @click="revokeLink(link)"
                        >
                          Revoke
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
                <v-row class="mt-2" align="center">
                  <v-col cols="5">
                    <v-text-field
                      v-model="newLinkLabel"
                      label="Label (optional)"
                      density="compact"
                      variant="outlined"
                      hide-details
                      :maxlength="120"
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-select
                      v-model="newLinkDays"
                      :items="LINK_EXPIRY_OPTIONS"
                      item-title="title"
                      item-value="value"
                      label="Expires"
                      density="compact"
                      variant="outlined"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="3">
                    <v-btn
                      variant="flat"
                      color="primary"
                      size="small"
                      :loading="creatingLink"
                      :disabled="creatingLink || selectedConfigIds.length !== 1"
                      @click="createLink"
                    >
                      <v-icon start size="small">mdi-link-plus</v-icon>
                      Create
                    </v-btn>
                  </v-col>
                </v-row>
                <v-alert
                  v-if="createdLinkUrl"
                  type="success"
                  variant="tonal"
                  density="compact"
                  class="mt-3"
                >
                  <div class="text-caption">
                    Copy this link now; it is not shown again.
                  </div>
                  <div class="d-flex align-center">
                    <code class="created-link flex-grow-1">{{
                      createdLinkUrl
                    }}</code>
                    <v-btn
                      size="x-small"
                      variant="text"
                      icon="mdi-content-copy"
                      aria-label="Copy link"
                      @click="copyCreatedLink"
                    />
                  </div>
                  <div class="text-caption mt-1">
                    Embed (no toolbar):
                    <code class="created-link">{{ createdEmbedUrl }}</code>
                  </div>
                </v-alert>
              </v-col>
            </v-row>
          </template>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <copy-link-button
          v-if="datasetId"
          :route-path="`/dataset/${datasetId}`"
          tooltip="Copy shareable link to this dataset"
        />
        <v-spacer />
        <v-btn variant="text" size="small" @click="close">Done</v-btn>
      </v-card-actions>
    </v-card>

    <!-- Confirmation Dialog for Remove User -->
    <v-dialog v-model="confirmDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h6">Remove Access</v-card-title>
        <v-card-text>
          Are you sure you want to remove access for
          <strong>{{ userToRemove?.name || userToRemove?.login }}</strong
          >?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="confirmDialog = false">
            Cancel
          </v-btn>
          <v-btn variant="flat" color="error" size="small" @click="removeUser">
            Remove
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { IGirderSelectAble } from "@/girder";
import store from "@/store";
import { shareLinkUrl } from "@/store/ShareLinkAPI";
import type { ISetDatasetPublicResult } from "@/store/GirderAPI";
import {
  finishPublish,
  isPublishPending,
  publishSettleCount,
  settledPublicValue,
  startPublish,
} from "@/utils/pendingPublishes";
import {
  finishMutation,
  isMutationPending,
  isUserMutationPending,
  mutationKeys,
  mutationSettleCount,
  startMutation,
} from "@/utils/pendingMutations";
import { logError } from "@/utils/log";
import { accessLevelLabel } from "@/utils/accessLevel";
import {
  IDataset,
  IDatasetAccessUser,
  IDatasetAccessConfiguration,
  IDatasetView,
  IShareLink,
} from "@/store/model";
import CopyLinkButton from "@/components/CopyLinkButton.vue";

// Suppress unused import warnings — auto-registered in <script setup>
void CopyLinkButton;

const props = defineProps<{
  dataset: IGirderSelectAble | IDataset | null;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const dialog = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit("update:modelValue", val),
});

/** Extract the dataset ID regardless of whether it's IGirderSelectAble or IDataset */
const datasetId = computed((): string | null => {
  if (!props.dataset) return null;
  if ("_id" in props.dataset) return (props.dataset as IGirderSelectAble)._id;
  if ("id" in props.dataset) return (props.dataset as IDataset).id;
  return null;
});

const loading = ref(false);
const showError = ref(false);
const errorString = ref("");

// Share links (admin only)
const LINK_EXPIRY_OPTIONS = [
  { value: 7, title: "7 days" },
  { value: 30, title: "30 days" },
  { value: 90, title: "90 days" },
  { value: 0, title: "Never" },
];
const shareLinks = ref<IShareLink[]>([]);
const newLinkLabel = ref("");
const newLinkDays = ref(30);
const createdLinkUrl = ref<string | null>(null);
const createdEmbedUrl = ref<string | null>(null);
// The link whose URL is shown above: only revoking that one hides it.
let createdLinkId: string | null = null;

// Access list data
const isPublic = ref(false);
const users = ref<IDatasetAccessUser[]>([]);
const configurations = ref<IDatasetAccessConfiguration[]>([]);
const selectedConfigIds = ref<string[]>([]);
// The share endpoint needs WRITE on every view and configuration it is
// sent, so only those the caller can write are ever included.
const writableViewIds = ref<Set<string>>(new Set());

// Associated dataset views (needed for API calls)
const associatedViews = ref<IDatasetView[]>([]);

// Loading states
// A set_public in flight for the shown dataset, from this dialog or any other
// (see utils/pendingPublishes): no opposite request until it settles.
const publicLoading = computed(
  () => datasetId.value !== null && isPublishPending(datasetId.value),
);
// Set when set_public left views/collections owned by other users in the
// other state: changing those is their owners' call, so the checkbox may not
// cover them.
const publicSkippedNotice = ref("");
// In-progress state of the other sharing changes, read from the shared
// registry so it lasts until the server responds, across dialog sessions
// and instances (utils/pendingMutations).
// Add is unavailable while any user's access to the dataset is changing (it
// can name any of them), and each user's controls while an Add is running.
const addUserLoading = computed(
  () => datasetId.value !== null && isUserMutationPending(datasetId.value),
);
const creatingLink = computed(
  () =>
    datasetId.value !== null &&
    isMutationPending(mutationKeys.createLink(datasetId.value)),
);
function isUserPending(userId: string): boolean {
  const id = datasetId.value;
  return (
    id !== null &&
    (isMutationPending(mutationKeys.user(id, userId)) ||
      isMutationPending(mutationKeys.addUser(id)))
  );
}
function isRevoking(linkId: string): boolean {
  return isMutationPending(mutationKeys.revokeLink(linkId));
}

// Add user form
const newUserEmail = ref("");
const newUserAccessLevel = ref(0); // Default to READ

// Confirmation dialog
const confirmDialog = ref(false);
const userToRemove = ref<IDatasetAccessUser | null>(null);

const accessLevelItems = [
  { text: "Read", value: 0 },
  { text: "Write", value: 1 },
];

// The caller's effective level from the server (groups and site admin
// included), not their direct row in the users list, which can be missing.
const currentUserLevel = ref(-1);

// Collections, public access and share links stay owner-only
const isResourceAdmin = computed((): boolean => currentUserLevel.value >= 2);

// WRITE collaborators may share too, but the server refuses any change
// above the caller's own level, so mirror that here.
const canManageUsers = computed((): boolean => currentUserLevel.value >= 1);

// The server's reason (e.g. a level above the caller's own) beats a
// generic message; only the unknown-user code needs translating.
function shareErrorMessage(response: string, unknownUser: string): string {
  return response === "badEmailOrUsername" ? unknownUser : response;
}

// With nothing shareable every add/edit/remove would fail, so offer none
const canShareAny = computed((): boolean =>
  configurations.value.some(isConfigShareable),
);

function canEditUser(user: IDatasetAccessUser): boolean {
  return (
    canManageUsers.value &&
    canShareAny.value &&
    user.level !== 2 &&
    user.level <= currentUserLevel.value
  );
}

watch(dialog, (val) => {
  if (val && props.dataset) {
    fetchAccessInfo(datasetId.value!);
  } else if (!val) {
    resetState();
  }
});

// The dialog is reused: when it moves to another dataset while open, drop
// everything that belonged to the previous one and reload.
watch(datasetId, (id, previousId) => {
  if (dialog.value && id && id !== previousId) {
    resetDatasetState();
    fetchAccessInfo(id);
  }
});

// When a publish of the shown dataset settles -- from this dialog or another
// instance -- take its result: an access load that overlapped it skipped
// the flag it read mid-write, so nothing else would correct the checkbox.
// (Keyed on the dataset too: switching away from a pending dataset also
// turns publicLoading off, and must not apply another dataset's result.)
watch(
  () => [datasetId.value, publicLoading.value] as const,
  ([id, pending], [previousId, wasPending]) => {
    if (id && id === previousId && wasPending && !pending) {
      const value = settledPublicValue(id);
      if (value !== undefined) {
        isPublic.value = value;
      }
    }
  },
);

// The counterpart for the other sharing changes: when one on the shown
// dataset settles -- from this dialog session, an earlier one, or another
// instance -- refresh from the server. A dialog that loaded while the change
// was in flight (or whose session dropped the change's result) would
// otherwise keep stale rows; loads are latest-wins, so the refresh after the
// last change settles is the one that sticks.
watch(
  () =>
    [
      datasetId.value,
      datasetId.value === null ? 0 : mutationSettleCount(datasetId.value),
    ] as const,
  ([id, count], [previousId, previousCount]) => {
    if (dialog.value && id && id === previousId && count !== previousCount) {
      fetchAccessInfo(id, true);
    }
  },
);

// Everything that belongs to the dataset the dialog shows. Moving to another
// dataset clears all of it (and closing the dialog clears it too, via
// resetState); keep every dataset-scoped field here, so the two paths cannot
// drift apart -- a field missed here survives a dataset switch and acts on
// the wrong dataset (a pending removal confirmation, a link list, a
// one-time link URL).
function resetDatasetState() {
  // Start a new dialog session and disown in-flight requests. Bumped on
  // every reset -- closing the dialog or moving to another dataset -- since
  // the dataset id alone recurs: after A -> B -> A, a request started in
  // the first A session would otherwise look current again (claimDialog).
  dialogGeneration++;
  shareLinksRequest++;
  accessRequest++;
  shareLinks.value = [];
  createdLinkUrl.value = null;
  createdEmbedUrl.value = null;
  createdLinkId = null;
  loading.value = false;
  showError.value = false;
  errorString.value = "";
  isPublic.value = false;
  publicSkippedNotice.value = "";
  users.value = [];
  currentUserLevel.value = -1;
  configurations.value = [];
  selectedConfigIds.value = [];
  writableViewIds.value = new Set();
  associatedViews.value = [];
  userToRemove.value = null;
  confirmDialog.value = false;
  // Inputs typed for the previous dataset: one click would otherwise apply
  // them to the new one (grant that user access, label a link). The link
  // expiry choice is a preference, not dataset input, and is kept.
  newUserEmail.value = "";
  newUserAccessLevel.value = 0;
  newLinkLabel.value = "";
  // In-progress flags are not reset here: they follow the requests
  // themselves (utils/pendingMutations), which keep running on the server.
}

// Closing the dialog: the same full reset as a dataset switch.
function resetState() {
  resetDatasetState();
}

// Bumped per fetch and by every reset: only the latest fetch, for the
// dataset still shown, may write the dialog's state.
let accessRequest = 0;

// Loads the dataset's access list, links and views. A full load (opening the
// dialog) shows the spinner, starts from a clean slate and selects every
// shareable collection. A refresh (after a sharing change settles, see the
// mutation-settle watcher) keeps the content up, the notice, and the user's
// collection selection minus what is no longer shareable; a refresh that
// supersedes a full load still in progress finishes it as a full load. The
// refresh is also what re-reads the caller's own level after they change
// their own entry (only the server knows whether a group still grants it).
async function fetchAccessInfo(id: string, refresh = false) {
  const full = !refresh || loading.value;
  fetchShareLinks(id);
  const request = ++accessRequest;
  const isCurrent = () => request === accessRequest && datasetId.value === id;
  // A publish pending now, or settling before this fetch returns, wrote (or
  // is writing) the public flag this fetch reads; its own response sets the
  // checkbox instead.
  const settledAtStart = publishSettleCount(id);
  if (full) {
    loading.value = true;
    showError.value = false;
    // The notice describes the last publish of the dataset it was shown for.
    publicSkippedNotice.value = "";
    // Drop the previous load's dataset-scoped state up front: if this load
    // fails, the dialog must not keep another dataset's users, rights
    // (which enable the controls) or views (which add/remove would submit).
    users.value = [];
    currentUserLevel.value = -1;
    configurations.value = [];
    selectedConfigIds.value = [];
    writableViewIds.value = new Set();
    associatedViews.value = [];
  }
  try {
    // Fetch access list from new endpoint
    const accessList = await store.api.getDatasetAccess(id);
    if (!isCurrent()) return;

    if (!isPublishPending(id) && publishSettleCount(id) === settledAtStart) {
      isPublic.value = accessList.public;
    }
    users.value = accessList.users;
    currentUserLevel.value = accessList.currentUserLevel;
    configurations.value = accessList.configurations;
    writableViewIds.value = new Set(accessList.writableViewIds);

    // Also fetch dataset views for the share API calls
    const views = await store.api.findDatasetViews({ datasetId: id });
    if (!isCurrent()) return;
    associatedViews.value = views;
    // Selection needs the views (isConfigShareable). A full load selects
    // every shareable collection; a refresh keeps the user's choice, minus
    // collections that went away or are no longer shareable.
    const shareableIds = configurations.value
      .filter(isConfigShareable)
      .map((c) => c.id);
    selectedConfigIds.value = full
      ? shareableIds
      : selectedConfigIds.value.filter((c) => shareableIds.includes(c));
  } catch (error) {
    logError(`Failed to fetch access info for dataset ${id}`, error);
    if (!isCurrent()) return;
    // Without the list we can't know the caller's rights: fail closed. A
    // failed refresh is usually the 403 after removing your own access, so
    // only a full load reports it.
    currentUserLevel.value = -1;
    if (full) {
      errorString.value = "Failed to load access information";
      showError.value = true;
    }
  } finally {
    if (isCurrent()) {
      loading.value = false;
    }
  }
}

function close() {
  dialog.value = false;
}

// A configuration can be shared only with one of its views, and the share
// endpoint needs WRITE on both. This one predicate decides selection,
// checkbox enabling and pruning, so a collection is never shown selected
// while getSelectedViews silently drops it.
function isConfigShareable(config: IDatasetAccessConfiguration): boolean {
  return (
    config.currentUserLevel >= 1 &&
    associatedViews.value.some(
      (view) =>
        view.configurationId === config.id &&
        writableViewIds.value.has(view.id),
    )
  );
}

function getSelectedViews(): IDatasetView[] {
  // Views of the selected configurations that the caller can write
  return associatedViews.value.filter(
    (view) =>
      selectedConfigIds.value.includes(view.configurationId) &&
      writableViewIds.value.has(view.id),
  );
}

// Views/collections owned by other users are left as they are in both
// directions (set_public changes only what the caller administers).
function skippedNotice(result: ISetDatasetPublicResult) {
  const parts = [
    [result.configurationsSkipped, "collection"],
    [result.datasetViewsSkipped, "view"],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, noun]) => `${count} ${noun}${count === 1 ? "" : "s"}`);
  if (parts.length === 0) {
    return "";
  }
  const [stayed, target] = result.public
    ? ["private", "public"]
    : ["public", "private"];
  return (
    `${parts.join(" and ")} owned by other users stayed ${stayed}; ` +
    `only their owners can make them ${target}.`
  );
}

// The dialog's session, bumped by every reset (resetDatasetState: closing
// the dialog or moving it to another dataset). This instance is reused
// across datasets and across close/reopen, so every async handler captures
// claimDialog() when it starts and writes its result, error or loading flag
// back only while the dialog still shows that session and dataset; a late
// response must not land in whatever the dialog shows now. Starting a request
// does not bump the session: one dataset's request must not silence
// another's.
let dialogGeneration = 0;

function claimDialog(): () => boolean {
  const generation = dialogGeneration;
  const id = datasetId.value;
  return () => generation === dialogGeneration && datasetId.value === id;
}

async function togglePublic(newValue: boolean | null) {
  if (!props.dataset) return;
  const id = datasetId.value!;
  const value = !!newValue;
  // One publish per dataset at a time (the checkbox is disabled meanwhile);
  // undo the v-model flip that already happened.
  if (isPublishPending(id)) {
    isPublic.value = !value;
    return;
  }
  const isCurrent = claimDialog();

  startPublish(id);
  showError.value = false;
  publicSkippedNotice.value = "";
  // What the checkbox should show once this settles; shared with every
  // dialog instance showing the dataset (see the publicLoading watcher).
  let settledValue = !value;
  try {
    const result = await store.api.setDatasetPublic(id, value);
    settledValue = value;
    if (isCurrent()) {
      publicSkippedNotice.value = skippedNotice(result);
    }
  } catch (error) {
    logError("Failed to toggle public access", error);
    if (isCurrent()) {
      errorString.value = "Failed to update public access";
      showError.value = true;
    }
  } finally {
    finishPublish(id, settledValue);
  }
}

async function updateUserAccess(user: IDatasetAccessUser, newLevel: number) {
  const selectedViews = getSelectedViews();
  if (selectedViews.length === 0) {
    errorString.value = "Please select at least one collection";
    showError.value = true;
    return;
  }

  const id = datasetId.value;
  if (!id) return;
  // One change per user at a time, across dialog sessions and instances
  // (see utils/pendingMutations), and none while an Add (which can name this
  // user) is in flight; the controls are disabled meanwhile.
  const key = mutationKeys.user(id, user.id);
  if (isUserPending(user.id)) return;
  const isCurrent = claimDialog();
  startMutation(key);
  showError.value = false;
  try {
    const response = await store.api.shareDatasetView(
      selectedViews,
      user.login,
      newLevel,
    );
    if (!isCurrent()) return;

    if (typeof response === "string") {
      errorString.value = shareErrorMessage(response, "User not found");
      showError.value = true;
    } else {
      // Update local state
      const userIndex = users.value.findIndex((u) => u.id === user.id);
      if (userIndex >= 0) {
        users.value[userIndex].level = newLevel as 0 | 1 | 2;
      }
    }
  } catch (error) {
    logError("Failed to update user access", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to update user access";
    showError.value = true;
  } finally {
    finishMutation(key, id);
  }
}

function confirmRemoveUser(user: IDatasetAccessUser) {
  userToRemove.value = user;
  confirmDialog.value = true;
}

async function removeUser() {
  if (!userToRemove.value) return;

  // Consume the confirmation now: it is this click's, and another removal
  // may be confirmed while this one runs.
  const user = userToRemove.value;
  userToRemove.value = null;
  confirmDialog.value = false;

  const selectedViews = getSelectedViews();
  if (selectedViews.length === 0) {
    errorString.value = "Please select at least one collection";
    showError.value = true;
    return;
  }

  const id = datasetId.value;
  if (!id) return;
  // Same key as an access change: both rewrite this user's access.
  const key = mutationKeys.user(id, user.id);
  if (isUserPending(user.id)) return;
  const isCurrent = claimDialog();
  startMutation(key);
  showError.value = false;
  try {
    const response = await store.api.shareDatasetView(
      selectedViews,
      user.login,
      -1, // -1 = remove; the server deletes the ACL entry
    );
    if (!isCurrent()) return;

    if (typeof response === "string") {
      errorString.value = shareErrorMessage(response, "User not found");
      showError.value = true;
    } else {
      // Remove user from local state
      users.value = users.value.filter((u) => u.id !== user.id);
    }
  } catch (error) {
    logError("Failed to remove user access", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to remove user access";
    showError.value = true;
  } finally {
    finishMutation(key, id);
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

// Only the latest list request may commit. The dialog lists on open and
// refreshes after every link create/revoke settles (the mutation-settle
// watcher), so the list after the last change is the one that sticks.
let shareLinksRequest = 0;

async function fetchShareLinks(id: string) {
  const request = ++shareLinksRequest;
  try {
    const links = await store.shareLinkAPI.list(id);
    if (request === shareLinksRequest && datasetId.value === id) {
      shareLinks.value = links;
    }
  } catch (error) {
    logError("Failed to list share links", error);
  }
}

function configurationName(configurationId: string): string {
  return (
    configurations.value.find((c) => c.id === configurationId)?.name ??
    configurationId
  );
}

async function createLink() {
  const selectedViews = getSelectedViews();
  if (selectedViews.length !== 1) {
    errorString.value = "Select exactly one collection for the link";
    showError.value = true;
    return;
  }
  const id = datasetId.value;
  if (!id) return;
  // One create per dataset at a time: a repeat while the first is in
  // flight would mint a second link whose token is never shown.
  const key = mutationKeys.createLink(id);
  if (isMutationPending(key)) return;
  const isCurrent = claimDialog();
  startMutation(key);
  showError.value = false;
  try {
    const link = await store.shareLinkAPI.create(
      selectedViews[0].id,
      newLinkDays.value,
      newLinkLabel.value.trim(),
    );
    // Closed or moved on: the link exists (it is listed, and revocable,
    // the next time this dataset's dialog opens), but its URL must not
    // appear in a dialog for another session or dataset.
    if (!isCurrent()) return;
    // The list refreshes when this settles (mutation-settle watcher).
    createdLinkId = link._id;
    createdLinkUrl.value = shareLinkUrl(link.token);
    createdEmbedUrl.value = shareLinkUrl(link.token, true);
    newLinkLabel.value = "";
  } catch (error) {
    logError("Failed to create a share link", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to create the share link";
    showError.value = true;
  } finally {
    finishMutation(key, id);
  }
}

async function revokeLink(link: IShareLink) {
  const id = datasetId.value;
  if (!id) return;
  const key = mutationKeys.revokeLink(link._id);
  if (isMutationPending(key)) return;
  const isCurrent = claimDialog();
  startMutation(key);
  showError.value = false;
  try {
    await store.shareLinkAPI.revoke(link._id);
    if (!isCurrent()) return;
    // Drop it now; the refresh when this settles confirms it. (No longer
    // bumps the list counter: that dropped a create's newer list.)
    shareLinks.value = shareLinks.value.filter((l) => l._id !== link._id);
    // The new URL is not shown again: keep it unless it is the one revoked.
    if (link._id === createdLinkId) {
      createdLinkId = null;
      createdLinkUrl.value = null;
      createdEmbedUrl.value = null;
    }
  } catch (error) {
    logError("Failed to revoke a share link", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to revoke the share link";
    showError.value = true;
  } finally {
    finishMutation(key, id);
  }
}

async function copyCreatedLink() {
  if (createdLinkUrl.value) {
    await navigator.clipboard.writeText(createdLinkUrl.value);
  }
}

async function addUser() {
  if (!newUserEmail.value) return;

  const selectedViews = getSelectedViews();
  if (selectedViews.length === 0) {
    errorString.value = "Please select at least one collection";
    showError.value = true;
    return;
  }

  const id = datasetId.value;
  if (!id) return;
  const key = mutationKeys.addUser(id);
  // The login/email can name any user of the dataset: no Add while any
  // user's access is being changed, and vice versa (isUserPending).
  if (isUserMutationPending(id)) return;
  const isCurrent = claimDialog();
  startMutation(key);
  showError.value = false;
  try {
    const response = await store.api.shareDatasetView(
      selectedViews,
      newUserEmail.value,
      newUserAccessLevel.value,
    );
    if (!isCurrent()) return;

    if (typeof response === "string") {
      errorString.value = shareErrorMessage(
        response,
        "Unknown user. Please check the username or email.",
      );
      showError.value = true;
    } else {
      // The access list refreshes when this settles (mutation-settle
      // watcher), keeping the collection selection.
      newUserEmail.value = "";
      newUserAccessLevel.value = 0;
    }
  } catch (error) {
    logError("Failed to add user", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to add user";
    showError.value = true;
  } finally {
    finishMutation(key, id);
  }
}

defineExpose({
  dialog,
  datasetId,
  shareLinks,
  createLink,
  revokeLink,
  fetchShareLinks,
  createdLinkUrl,
  newLinkDays,
  newLinkLabel,
  loading,
  showError,
  errorString,
  isPublic,
  users,
  configurations,
  selectedConfigIds,
  associatedViews,
  publicLoading,
  publicSkippedNotice,
  isUserPending,
  isRevoking,
  addUserLoading,
  creatingLink,
  newUserEmail,
  newUserAccessLevel,
  confirmDialog,
  userToRemove,
  accessLevelItems,
  isResourceAdmin,
  currentUserLevel,
  canManageUsers,
  canEditUser,
  canShareAny,
  resetState,
  fetchAccessInfo,
  close,
  getSelectedViews,
  isConfigShareable,
  togglePublic,
  updateUserAccess,
  confirmRemoveUser,
  removeUser,
  addUser,
});
</script>

<style lang="scss" scoped>
.created-link {
  word-break: break-all;
  font-size: 0.75rem;
}
</style>
