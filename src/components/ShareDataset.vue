<template>
  <v-dialog v-model="dialog" max-width="750px">
    <v-card>
      <v-card-title>
        {{ isResourceAdmin ? "Share Dataset:" : "Sharing:" }}
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
                :label="config.name"
                :value="config.id"
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
                        v-if="isResourceAdmin"
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
                        <template v-else-if="isResourceAdmin">
                          <v-select
                            :model-value="user.level"
                            :items="accessLevelItems"
                            item-title="text"
                            item-value="value"
                            density="compact"
                            hide-details
                            :loading="userLoading === user.id"
                            :disabled="userLoading === user.id"
                            @update:model-value="updateUserAccess(user, $event)"
                          />
                        </template>
                        <span v-else class="font-weight-medium">
                          {{ accessLevelLabel(user.level) }}
                        </span>
                      </td>
                      <td v-if="isResourceAdmin" class="text-center">
                        <v-btn
                          v-if="user.level !== 2"
                          variant="text"
                          icon
                          size="small"
                          color="error"
                          :loading="userLoading === user.id"
                          :disabled="userLoading === user.id"
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
                          <span>Cannot remove dataset owner</span>
                        </v-tooltip>
                      </td>
                    </tr>
                  </tbody>
                </template>
              </v-table>
            </v-col>
          </v-row>

          <!-- Add User Form (admin only) -->
          <template v-if="isResourceAdmin">
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12">
                <div class="subtitle-2 mb-2">Add User:</div>
                <v-row density="comfortable" align="center">
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
                          :loading="revokingLinkId === link._id"
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
const creatingLink = ref(false);
const revokingLinkId = ref<string | null>(null);
const createdLinkUrl = ref<string | null>(null);
const createdEmbedUrl = ref<string | null>(null);
// The link whose URL is shown above: only revoking that one hides it.
let createdLinkId: string | null = null;

// Access list data
const isPublic = ref(false);
const users = ref<IDatasetAccessUser[]>([]);
const configurations = ref<IDatasetAccessConfiguration[]>([]);
const selectedConfigIds = ref<string[]>([]);

// Associated dataset views (needed for API calls)
const associatedViews = ref<IDatasetView[]>([]);

// Loading states
// A set_public in flight for the shown dataset, from this dialog or any other
// (see utils/pendingPublishes): no opposite request until it settles.
const publicLoading = computed(
  () => datasetId.value !== null && isPublishPending(datasetId.value),
);
// Set when publishing left views/collections owned by other users private:
// publishing those is their owners' call, so "Public" may not cover them.
const publicSkippedNotice = ref("");
const userLoading = ref<string | null>(null);
const addUserLoading = ref(false);

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

const isResourceAdmin = computed((): boolean => {
  const userId = store.girderUser?._id;
  if (!userId) return false;
  return users.value.some((u) => u.id === userId && u.level === 2);
});

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

// Everything that belongs to the dataset the dialog shows. Moving to another
// dataset clears all of it (and closing the dialog clears it too, via
// resetState); keep every dataset-scoped field here, so the two paths cannot
// drift apart -- a field missed here survives a dataset switch and acts on
// the wrong dataset (a pending removal confirmation, a link list, a
// one-time link URL).
function resetDatasetState() {
  // Disown in-flight loads: they belong to the previous dataset.
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
  configurations.value = [];
  selectedConfigIds.value = [];
  associatedViews.value = [];
  userToRemove.value = null;
  confirmDialog.value = false;
  // Inputs typed for the previous dataset: one click would otherwise apply
  // them to the new one (grant that user access, label a link). The link
  // expiry choice is a preference, not dataset input, and is kept.
  newUserEmail.value = "";
  newUserAccessLevel.value = 0;
  newLinkLabel.value = "";
  // In-progress flags of requests now disowned (claimDialog checks the
  // dataset): their late finally blocks no longer touch the dialog.
  userLoading.value = null;
  addUserLoading.value = false;
  creatingLink.value = false;
  revokingLinkId.value = null;
}

function resetState() {
  // A new session: requests from this one no longer write back, even for
  // the same dataset (claimDialog).
  dialogGeneration++;
  resetDatasetState();
}

// Bumped per fetch and by resetState(): only the latest fetch, for the
// dataset still shown, may write the dialog's state.
let accessRequest = 0;

async function fetchAccessInfo(id: string) {
  fetchShareLinks(id);
  const request = ++accessRequest;
  const isCurrent = () => request === accessRequest && datasetId.value === id;
  // A publish pending now, or settling before this fetch returns, wrote (or
  // is writing) the public flag this fetch reads; its own response sets the
  // checkbox instead.
  const settledAtStart = publishSettleCount(id);
  loading.value = true;
  showError.value = false;
  // The notice describes the last publish of the dataset it was shown for.
  publicSkippedNotice.value = "";
  // Drop the previous load's dataset-scoped state up front: if this load
  // fails, the dialog must not keep another dataset's users (whose admin
  // entry enables the controls) or views (which add/remove would submit).
  users.value = [];
  configurations.value = [];
  selectedConfigIds.value = [];
  associatedViews.value = [];
  try {
    // Fetch access list from new endpoint
    const accessList = await store.api.getDatasetAccess(id);
    if (!isCurrent()) return;

    if (!isPublishPending(id) && publishSettleCount(id) === settledAtStart) {
      isPublic.value = accessList.public;
    }
    users.value = accessList.users;
    configurations.value = accessList.configurations;
    // Select all configurations by default
    selectedConfigIds.value = accessList.configurations.map((c) => c.id);

    // Also fetch dataset views for the share API calls
    const views = await store.api.findDatasetViews({ datasetId: id });
    if (!isCurrent()) return;
    associatedViews.value = views;
  } catch (error) {
    logError(`Failed to fetch access info for dataset ${id}`, error);
    if (!isCurrent()) return;
    errorString.value = "Failed to load access information";
    showError.value = true;
  } finally {
    if (isCurrent()) {
      loading.value = false;
    }
  }
}

function close() {
  dialog.value = false;
}

function getSelectedViews(): IDatasetView[] {
  // Filter views to only include those with selected configurations
  return associatedViews.value.filter((view) =>
    selectedConfigIds.value.includes(view.configurationId),
  );
}

// Only publishing skips anything: making a dataset private unpublishes all
// of its views and collections.
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
  return (
    `${parts.join(" and ")} owned by other users stayed private; ` +
    "only their owners can make them public."
  );
}

// The dialog's session, bumped by resetState(). This instance is reused
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

  const isCurrent = claimDialog();
  userLoading.value = user.id;
  showError.value = false;
  try {
    const response = await store.api.shareDatasetView(
      selectedViews,
      user.login,
      newLevel,
    );
    if (!isCurrent()) return;

    if (typeof response === "string") {
      errorString.value =
        response === "badEmailOrUsername"
          ? "User not found"
          : "An error occurred";
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
    if (isCurrent()) {
      userLoading.value = null;
    }
  }
}

function confirmRemoveUser(user: IDatasetAccessUser) {
  userToRemove.value = user;
  confirmDialog.value = true;
}

async function removeUser() {
  if (!userToRemove.value) return;

  const user = userToRemove.value;
  confirmDialog.value = false;

  const selectedViews = getSelectedViews();
  if (selectedViews.length === 0) {
    errorString.value = "Please select at least one collection";
    showError.value = true;
    return;
  }

  const isCurrent = claimDialog();
  userLoading.value = user.id;
  showError.value = false;
  try {
    const response = await store.api.shareDatasetView(
      selectedViews,
      user.login,
      -1, // -1 to remove access (Girder convention)
    );
    if (!isCurrent()) return;

    if (typeof response === "string") {
      errorString.value =
        response === "badEmailOrUsername"
          ? "User not found"
          : "An error occurred";
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
    if (isCurrent()) {
      userLoading.value = null;
      userToRemove.value = null;
    }
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

// Only the latest list request may commit: the dialog lists on open, again
// after a create, and a revoke edits the list locally, so an older answer
// could otherwise hide a new link or bring back a revoked one.
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
  const isCurrent = claimDialog();
  creatingLink.value = true;
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
    createdLinkId = link._id;
    createdLinkUrl.value = shareLinkUrl(link.token);
    createdEmbedUrl.value = shareLinkUrl(link.token, true);
    newLinkLabel.value = "";
    if (datasetId.value) {
      await fetchShareLinks(datasetId.value);
    }
  } catch (error) {
    logError("Failed to create a share link", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to create the share link";
    showError.value = true;
  } finally {
    if (isCurrent()) {
      creatingLink.value = false;
    }
  }
}

async function revokeLink(link: IShareLink) {
  const isCurrent = claimDialog();
  revokingLinkId.value = link._id;
  showError.value = false;
  try {
    await store.shareLinkAPI.revoke(link._id);
    if (!isCurrent()) return;
    shareLinksRequest++; // an in-flight list predates the revoke
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
    if (isCurrent()) {
      revokingLinkId.value = null;
    }
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

  const isCurrent = claimDialog();
  addUserLoading.value = true;
  showError.value = false;
  try {
    const response = await store.api.shareDatasetView(
      selectedViews,
      newUserEmail.value,
      newUserAccessLevel.value,
    );
    if (!isCurrent()) return;

    if (typeof response === "string") {
      errorString.value =
        response === "badEmailOrUsername"
          ? "Unknown user. Please check the username or email."
          : "An error occurred";
      showError.value = true;
    } else {
      // Refresh the access list to show the new user
      if (props.dataset) {
        await fetchAccessInfo(datasetId.value!);
      }
      if (!isCurrent()) return;
      // Clear the form
      newUserEmail.value = "";
      newUserAccessLevel.value = 0;
    }
  } catch (error) {
    logError("Failed to add user", error);
    if (!isCurrent()) return;
    errorString.value = "Failed to add user";
    showError.value = true;
  } finally {
    if (isCurrent()) {
      addUserLoading.value = false;
    }
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
  userLoading,
  addUserLoading,
  newUserEmail,
  newUserAccessLevel,
  confirmDialog,
  userToRemove,
  accessLevelItems,
  isResourceAdmin,
  resetState,
  fetchAccessInfo,
  close,
  getSelectedViews,
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
