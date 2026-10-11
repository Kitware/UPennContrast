# Dataset location (XY / Z / T indices)

The viewer's location is `store.xy`, `store.z` and `store.time`: slider indices
into `dataset.xy`, `dataset.z` and `dataset.time`. An index past the end makes
every `dataset.images(...)` lookup at the current location miss. Raw snapshot
export then failed with "Image not found for channel …" (issue #1388, PR #1389).

## Where the location comes from

- A `?xy=&z=&time=` query (deep links, and the breadcrumb view switcher, which
  keeps the current query when it moves to another dataset).
- The dataset view's saved `lastLocation`.
- The navigator sliders, unrolled grid cells, snapshot restore, annotation
  navigation and the AI panel, all through `setXY` / `setZ` / `setTime`.

## How it is kept valid

- **One clamp, where the dataset lands.** `clampLocationToDatasetImpl` runs in
  `setSelectedDataset` right after the dataset commits, and at the end of
  `setDatasetViewId` for a view switch that keeps the dataset. Consumers do not
  guard their own lookups.
- **Setters clamp only against a settled dataset.** While a view loads,
  `this.dataset` is still the *outgoing* dataset. The setters read
  `locationDataset`, which is null while `sync.datasetLoading` is set, so a deep
  link valid for the incoming dataset is not cut to the outgoing one's size.
- **Unrolled axes are not clamped.** Unrolling collapses an axis to one entry,
  and rendering ignores the index of a one-entry axis. The value there is the
  frame to return to: a grid cell (and snapshot restore) sets it just before
  clearing the unroll flag, and the reload that rolls the axis up clamps it
  against the real dimensions.
- **"Unrolled" means the loaded dataset's shape, not the live flags.**
  `store.unrollZ` changes on click, but `this.dataset` only follows when its
  refresh lands, and a stale refresh can land after the flag has flipped back.
  `setSelectedDataset` records the flags each dataset was fetched with in
  `datasetUnroll`, and every clamp reads that.
- **The view-switch clamp only runs against the view's own dataset.** If the
  new dataset fails to load, `this.dataset` is still the previous one.
- **Saves are debounced, checked and flushed.** `updateLastLocationInDatasetView`
  schedules a save 5 s out. `saveLastLocationInDatasetView` only writes when
  the loaded dataset matches `datasetView.datasetId` and nothing is loading, and
  it skips a write equal to the saved value. Anything that replaces the view
  (`setDatasetViewId`) or the dataset (`setSelectedDataset`) flushes the pending
  save first, while the two still match. Every clamp site schedules a save.

## Regression checklist

Run `pnpm test src/utils/datasetLocation.test.ts src/store/__tests__/datasetLocationClamp.test.ts`.

### Clamping

- [ ] **A deep link past the dataset's size is clamped on load.** — *"clamps a deep-linked location past the dataset's dimensions on load"*
- [ ] **Setters never clamp against the outgoing dataset.** A deep link that only fits the incoming dataset survives the switch. — *"keeps a deep link that is valid for the incoming dataset but not the outgoing one"*
- [ ] **A view switch on the same dataset still clamps**, since `setSelectedDataset` is skipped there. — *"clamps a saved lastLocation when the dataset does not change"*
- [ ] **Setters clamp once the dataset is settled**, including NaN and negative input. — *"clamps setXY/setZ/setTime once the dataset is loaded"*
- [ ] **Unrolled axes keep their target through the roll-up.** Clamping them against the collapsed one-entry axis sent every grid-cell click and rolled-up snapshot restore to frame 0 (Codex round 3). — *"keeps a target set on an unrolled axis through the roll-up"*, *"leaves unrolled axes alone, since unrolling collapses them to one entry"*

- [ ] **Clamps follow the loaded dataset's shape, not the live unroll flags.** Toggling unroll on then off before the first refresh landed reset z to 0 (regression review). — *"keeps the location when a stale unrolled refresh lands after unroll is turned off"*
- [ ] **A failed load does not clamp against the previous dataset.** — *"does not clamp against the previous dataset when the new one fails to load"*

### Persistence

- [ ] **The clamped value is what gets saved**, so a view stops reopening out of range. — *"persists the clamped location, not the out-of-range one"*
- [ ] **Every clamp site schedules a save.** A refresh outside a view load (large-image change) clamped without saving (Codex round 1). — *"persists a location clamped by a dataset refresh outside a view load"*
- [ ] **Replacing the view flushes the pending save into the view being left.** — *"saves a pending location into the view being left, not the next one"*
- [ ] **Replacing the dataset flushes too.** `Dataset.vue` switches datasets with the old view still loaded, and the save was then rejected as a mismatch (Codex round 2). — *"saves a pending location before a direct dataset switch replaces the dataset"*
- [ ] **Nothing is saved mid-load**, when the location may still be an unchecked query value. — *"does not save a location while the dataset is still loading"*

### Known limitation

A clamp that runs inside a URL→store sync (a deep link like `?time=99` on a
10-frame dataset) is not written back to the URL: the route mapper suppresses
store→URL writes while it applies the URL. The URL keeps 99 while the store
holds 9, and a later route change re-applies 99, which clamps to 9 again. If
the dataset later gains frames (a large-image switch), that re-application
lands on frame 99. On master the store held the out-of-range 99 throughout.

### Test traps this feature proved

- A save scheduled by the view load stands in for the one under test. Drain the
  timers before the action you are checking, or the test passes against the
  unfixed code.
- The save clamps its own value, which can mask a missing guard. Use an
  in-range location when testing a guard, so only the guard can stop the save.
- `setSelectedDataset` reads the unroll flags after its first `await`. Two
  refreshes started in the same tick both see the final flags, so a test of a
  stale refresh must let the first fetch start before flipping the flag.
- lodash `debounce` captures the real `setTimeout` at import and ignores vitest
  fake timers, which is why the save delay is a plain module-level timer.

### Verified in-browser

Real clicks from a fresh page load: the repro URL (1×1 dataset at `?xy=12&z=3`)
opens at 0/0/0, raw download works, and the server's saved `lastLocation`
matches. The dataset-switch flush was also checked live with the fix
reverted, and the server value then went stale.
