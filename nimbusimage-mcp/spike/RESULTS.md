# Phase 0 spike: results

**Date:** 2026-10-11. **Plan:** [`NIMBUSIMAGE_MCP_SERVER.md`](../../codebaseDocumentation/NIMBUSIMAGE_MCP_SERVER.md), Phase 0.
**SDK:** `mcp==2.3.0` (`mcp-types==2.3.0`), Python 3.14, local compose stack (93 datasets,
up to 465K annotations per dataset).

## What was built

| File | Purpose |
|---|---|
| `server.py` | The five read-only tools from plan §5.3, served as stateless streamable HTTP on `127.0.0.1:8000/mcp`. Single-user auth from `NI_API_URL` / `NI_API_KEY`. Logs every call (tool, args, seconds, wire bytes, error) to `calls.jsonl`, or to `NI_MCP_CALL_LOG`. |
| `test_server.py` | Unit tests for the pure helpers: layer slice resolution against the frontend's rules, and logged size against the SDK's wire format. |
| `smoke_test.py` | Calls every tool over real HTTP with the SDK client, on a small dataset, the 465K-annotation dataset, and a dataset with a per-user contrast override, plus error paths. Saves the composites to `out/`. Dataset ids are from the author's local database. |
| `eval/run_eval.sh`, `eval/tasks.txt`, `eval/summarize.py` | Runs 12 real tasks through headless Claude Code (Opus 5.5) restricted to the MCP tools, in parallel, and summarizes tool choice, turns, cost, and answers. |

Run it:

```bash
python3 -m venv nimbusimage-mcp/.venv
nimbusimage-mcp/.venv/bin/pip install -e nimbusimage -r nimbusimage-mcp/spike/requirements.txt
cd nimbusimage-mcp
NI_API_KEY=unused .venv/bin/python -m pytest spike/test_server.py
NI_API_URL=http://localhost:8080/api/v1 NI_API_KEY=<key> NI_MCP_CALL_LOG=spike/calls.jsonl \
    .venv/bin/python spike/server.py
# in another shell
.venv/bin/python spike/smoke_test.py
spike/eval/run_eval.sh
# or interactively
claude mcp add --transport http --scope local nimbus-local http://127.0.0.1:8000/mcp
```

## Exit criteria

- [x] **Claude Code completes most tasks without hand-holding.** 12 of 12 answered
  correctly in the final run. The ten count/metadata answers were checked against MongoDB.
  The two image descriptions (tasks 4 and 6) were checked by looking at the same composites.
  The *first* run, before the review fixes, got task 4's pixel size wrong (1 µm instead of
  0.2125 µm) because the tool passed on `nimbusimage`'s made-up default (problem 6).
  Final run: median 4 turns, $0.05–$0.12 per task, 6–18 s.
- [x] **No single tool response is larger than about 2K tokens, except images.** The
  largest text response in the eval was 1.9 KB (~480 tokens) on the wire.
  `ni_datasets_list(limit=200)` in the smoke test is 10 KB (~2.5K tokens) for 93 datasets;
  see the changes below.
- [x] **A written list of tools to add, rename, or drop.** Below.
- [ ] **Placement decision.** Not made. The spike supplies the input (below); the choice
  needs the in-process option tried.

## Tool selection

Claude Code deferred all five tools and loaded them through tool search, picking them by name
every time (for example `select:mcp__nimbus__ni_datasets_list,…ni_annotations_count`). The
first real tool call was the right one in all 12 tasks, in both runs. The `ni_` prefix and
plain-language descriptions were enough at five tools; re-check at Phase 1's ~15.

Behavior worth noting:

- **Dataset by name:** every name-based task called `ni_datasets_list(name_contains=…)`
  first, then used the ID, and handled near-duplicate names ("…(XOA 4.0)" vs "…v2").
- **Semantic care:** asked for "nuclei", it found only the tag `488 blob` and said it could
  not confirm they were nuclei (no nuclear-stain channel; 8,594 objects across 42 time
  points and 11 z-slices). Asked for "cells", it used the tag breakdown to exclude 9
  `region` polygons (465,534, not 465,543).
- **Fan-out:** "which kidney dataset has the most annotations" took 16 sequential
  `ni_annotations_count` calls (19 turns). Correct, but it is the case for a
  multi-dataset count tool.

## Measurements

Final eval run, from `calls.jsonl` (42 calls, 0 errors, 12 parallel Claude sessions); sizes
are bytes on the wire (indented JSON, base64 images):

| Tool | Median latency | Max latency | Response |
|---|---|---|---|
| `ni_annotations_count` | 0.01 s | 0.07 s | ~50 B |
| `ni_dataset_info` | 0.02 s | 0.04 s | 0.5–0.6 KB; 2.5 KB for a 6-channel Xenium panel |
| `ni_annotations_summary` | 0.28 s | 0.56 s (465K annotations) | 0.1–0.3 KB |
| `ni_datasets_list` | 0.61 s | 0.82 s | 0.3–1.9 KB; 10 KB at limit 200 |
| `ni_image_get_composite` | 0.15 s | 0.15 s | 30–470 KB JPEG at 1024 px (sparse images compress well) |

Server memory: 98 MB idle, 227 MB after the whole parallel eval.

Composite latency is excellent even for a 54002×27328 slide: large_image's region endpoint
scales server-side from the pyramid, so the full-resolution frame never crosses the wire.

## Problems found, and what happened to them

1. **The first summary tool was a memory hazard. Fixed.** It counted tags over
   `GET upenn_annotation/stubs`, which ships one row per annotation into the MCP server: one
   call on the 465K dataset took RSS from 159 MB to 563 MB and 4–8 s, and the first parallel
   eval left RSS at **2.3 GB**. It now uses the existing server-side aggregation,
   `POST upenn_annotation/summary` (added for the selection summary, see
   `SELECTION_SUMMARY.md`): 0.6 s, no rows in the MCP server.
2. **Shape counts scan the whole dataset. Separate PR.** That endpoint had no shape
   breakdown, and `GET upenn_annotation/count?shape=` re-reads every annotation of the
   dataset (no `datasetId`+`shape` index): 0.25–0.9 s per shape on 465K annotations, ~2.9 s
   for all four. Branch `annotation-summary-shapes` adds a `shapes` facet to the summary's
   existing scan (+~50 ms). Until it is deployed, the summary tool omits `by_shape`.
3. **The composite did not look like the app. Fixed in the spike; `nimbusimage` still
   affected.** `nimbusimage.images.get_composite()` (which the spike copied) reads
   percentile contrast as quantiles; the app (`toStyle` in `src/store/images.ts`) maps the
   0–100 range linearly onto the frame histogram's min..max. It also ignored the user's
   per-view contrast overrides (`datasetView.layerContrasts`) and the layers' `constant` /
   `offset` / `max-merge` slice settings. The spike now follows the app's rules, using the
   caller's own view and its configuration. One of the author's views had a white point of
   17%, so the old composite of that dataset was far darker than the app shows. Not checked
   side by side in a browser (no session in the in-app browser); matched by code instead.
4. **PNG was the wrong encoding. Fixed.** A 1024 px composite was 1.1–1.2 MB as PNG (noisy
   microscopy compresses badly losslessly). JPEG q85 is 30–470 KB on the wire.
5. **Tags with `+` or `&` are mangled by `nimbusimage`. Worked around in the spike.**
   `AnnotationAccessor.count()` and `.list()` build their query strings by hand, so
   `tags=["CD8+"]` reaches the server as `"CD8 "` (silently 0) and `"a&b"` is a 400. The
   spike passes `parameters=` to the Girder client, which encodes.
6. **`nimbusimage` invents a pixel size. Worked around in the spike.** `Dataset.pixel_size`
   returns `1.0 µm` when the file has no `mm_x`; the real value often lives only in the
   configuration's `scales.pixelSize`. `ni_dataset_info` now reports the scales the app
   uses (view over configuration, then the file), and null when none is known.
7. **`client.list_datasets()` makes one `GET folder/{id}` per dataset** (93 requests), the
   looped-call pattern `CLAUDE.md` forbids: 0.4 s idle, 0.6–0.8 s under parallel load,
   growing linearly. It also finds datasets only through their views. Not fixed.
8. **`nimbusimage.get_composite()` has no size option** and fetches every channel at full
   resolution; the spike uses the private `_get_region(width=, height=)` and frame map.
9. **`rectangle` was missing** from the spike's shape list; the schema allows it and the
   local data uses it. Fixed. `nimbusimage`'s docstrings omit it too.

Items 3 and 5–8 are `nimbusimage` bugs to fix in that package (a separate change), so
the Phase 1 server can call it instead of working around it.

## Tool list changes for Phase 1

**Add**

- A crop or region argument on `ni_image_get_composite` (`left, top, right, bottom` in image
  pixels). Asked to describe the "Xenium tiny" ovary dataset, Claude could only report two
  small tissue patches on an empty canvas; it had no way to zoom in.
- Single-channel view: a `channels` argument on the composite, or a separate
  `ni_image_get` tool. The composite uses the saved layer visibility, so a hidden channel
  cannot be inspected.
- `ni_datasets_list` with optional per-dataset annotation counts, or
  `ni_annotations_count` taking a list of dataset IDs. Avoids the 16-call fan-out.
- The plan's Phase 1 tools (`ni_annotations_list`, property tools, worker tools,
  `ni_job_wait`, `ni_annotations_tag`, `ni_help_topic`).

**Change**

- `ni_datasets_list`: lower the hard cap from 200 to 100 and return compact JSON, so a full
  listing stays under ~2K tokens.
- All tools: the SDK sends dict results as indented JSON (`to_json(indent=2)`), roughly a
  third more bytes than compact. Return compact text or structured output.

**Keep as is**

- Tool names and argument shapes. Claude never confused tools.

**Drop**

- Nothing.

## Placement decision input (plan §11)

- Import cost is small: the SDK, `nimbusimage`, and Pillow import in 0.43 s with a 93 MB
  RSS; the server idles at ~98 MB and stayed under 230 MB through the parallel eval.
- Per-call CPU is small; the heavy work happens in Girder or large_image.
- The one large cost seen (problem 1) was a design bug, now fixed.

Neither option is ruled out on weight. A **sidecar** stays attractive because a bad tool can
be memory-limited and killed without taking Girder down. Mounting inside Girder's ASGI app
was not tried.

## Confirmed SDK facts (plan §12)

- `from mcp.server import MCPServer`; `MCPServer.run(transport="streamable-http",
  host=…, port=…, stateless_http=True)` exist in 2.3.0 as the plan assumed.
- Sync tool functions run in a worker thread (`anyio.to_thread.run_sync`), so a slow tool
  does not block other requests.
- `TokenVerifier` and `AuthSettings` live in `mcp.server.auth.provider` /
  `mcp.server.auth.settings`; `MCPServer(token_verifier=…, auth=…)` takes them. Not exercised
  in the spike.
- Tool types (`ToolAnnotations`, etc.) live in the separate `mcp_types` package.
- Stateless mode answers `tools/list` without an `initialize` handshake.

## Side notes

- Running `claude -p` in a `while read` loop over a file needs `< /dev/null`, because
  `claude -p` appends piped stdin to the prompt; without it the first session got every task.
- The spike's cached client mints one Girder token per server process, not per call:
  4 API-key tokens in the Mongo `token` collection over the first session (3 server starts
  plus one probe script) across ~100 tool calls. Phase 1's per-request clients must keep
  that property through the exchange cache (plan §6.2).
- On a 401 the spike forgets its cached client so the next call re-exchanges the API key
  (an expired session token would otherwise fail forever).
