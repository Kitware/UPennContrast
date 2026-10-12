# nimbusimage-mcp

An [MCP](https://modelcontextprotocol.io) server that lets Claude (Claude Code,
Claude Desktop, claude.ai connectors) work with NimbusImage: find datasets, count
and summarize annotations, look at images, read measurements, run analysis
workers, and tag annotations.

Every call runs **as the caller**. A client sends its own Girder API key as a
bearer token; the server exchanges it for a Girder session and calls the
NimbusImage REST API with it, so Girder's access control decides what anyone can
see or change. The server holds no credentials of its own.

Design and roadmap: [`codebaseDocumentation/NIMBUSIMAGE_MCP_SERVER.md`](../codebaseDocumentation/NIMBUSIMAGE_MCP_SERVER.md).
Phase 0 measurements: [`eval/PHASE0_RESULTS.md`](eval/PHASE0_RESULTS.md).

## Tools

All names start with `ni_`. Results are compact JSON, capped, and summary-first;
images are downsampled JPEGs.

| Tool | What it does |
|---|---|
| `ni_datasets_list` | Datasets you can open (`{id, name}`, max 100; filter by name) |
| `ni_dataset_info` | Size, channels, z/time/xy counts, pixel size |
| `ni_annotations_count` | Counts in one or more datasets (up to 50), by shape and tags |
| `ni_annotations_summary` | Total, counts by tag and by shape |
| `ni_annotations_list` | Specific annotations (max 200 per call), with center and location |
| `ni_annotations_tag` | **Writes.** Add/remove/replace tags on annotations chosen by a query (max 10,000) |
| `ni_image_get_composite` | The image as the app draws it, optionally cropped |
| `ni_image_get_channel` | One channel in grayscale, auto-contrast |
| `ni_properties_list` | Measurements set up for a dataset, their value paths and uncomputed counts |
| `ni_property_values_summary` | Count/mean/std/min/max per value path, optionally filtered |
| `ni_property_histogram` | Equal-count histogram of one value path |
| `ni_property_compute` | **Writes.** Start computing a measurement (returns a job id) |
| `ni_workers_list` | Annotation and property workers on the server |
| `ni_worker_interface` | A worker's parameters and the value format each expects |
| `ni_worker_run` | **Writes.** Run an annotation worker (returns a job id) |
| `ni_job_wait` | Wait (bounded) for a job and report its outcome |
| `ni_help_topic` | NimbusImage user documentation by topic |

Tools that write are marked with the MCP `destructiveHint`, so clients ask
before running them.

## Running it

With the local compose stack (from the repo root; **not** from a git worktree,
see the `nimbus-local-ops` skill):

```bash
docker compose --profile mcp up -d mcp     # http://localhost:8001/mcp
```

Plain `docker compose up` does not start it. Or run it on the host:

```bash
python3 -m venv nimbusimage-mcp/.venv
nimbusimage-mcp/.venv/bin/pip install -e nimbusimage -e "nimbusimage-mcp[dev]"
NI_API_URL=http://localhost:8080/api/v1 nimbusimage-mcp/.venv/bin/nimbusimage-mcp
```

| Variable | Default | Meaning |
|---|---|---|
| `NI_API_URL` | `http://localhost:8080/api/v1` | Girder REST root the server calls |
| `NI_MCP_HOST` / `NI_MCP_PORT` | `127.0.0.1` / `8000` | Where it listens (the image uses `0.0.0.0`) |
| `NI_MCP_PUBLIC_URL` | `http://localhost:<port>/mcp` | This server's public URL (the OAuth resource id) |
| `NI_MCP_ISSUER_URL` | `http://localhost:8080` | Advertised authorization server (Girder) |
| `NI_MCP_CALL_LOG` | unset | JSON-lines call log (tool, user id, seconds, bytes, error) |
| `NI_MCP_MAX_JOB_WAIT` | `240` | Longest `ni_job_wait`, in seconds; keep it under every HTTP timeout in front of the server |

`NI_API_KEY` and `NI_TOKEN` must **not** be set: the server refuses to start
with a service credential.

## Connecting Claude Code

Create an API key in Girder (Swagger at `http://localhost:8080/api/v1`, `POST
/api_key`). A full-access key is simplest; a scoped key needs `core.user_auth`
for `ni_job_wait` and `ni_help_topic`.

```bash
claude mcp add --transport http nimbus http://localhost:8001/mcp \
  --header "Authorization: Bearer <your API key>"
```

Each person uses their own key. Deleting or deactivating the key in Girder ends
access on the next request.

## How auth works

- `Authorization: Bearer <key>` is exchanged with `POST api_key/token` and the
  session is cached by SHA-256 of the key until an hour before it expires, so a
  user mints one Girder token per key, not one per call.
- Every request re-checks the cached session (`GET token/current`), which is what
  makes a revoked key fail at once.
- Requests without a valid key get `401` with a `WWW-Authenticate` challenge
  pointing at `/.well-known/oauth-protected-resource/mcp`.
- Logs carry the user id, never the key or session token.
- The server is stateless (streamable HTTP, no sessions): any instance can
  serve any request.

## Tests

Run from `nimbusimage-mcp/` (from the repo root, the `nimbusimage/` folder
shadows the installed package):

```bash
cd nimbusimage-mcp
.venv/bin/python -m pytest -m "not integration"   # unit + HTTP auth, no network
.venv/bin/python -m pytest -m integration         # against the local stack
.venv/bin/flake8 nimbusimage_mcp tests
```

Integration tests log in as the admin from `tmp/login_credentials.txt` (line 1
login, line 2 password), create a throwaway user and dataset, and delete them
afterwards. Image and worker tests use `NI_TEST_IMAGE_DATASET` (a dataset id with
an image). Token counts are read from MongoDB through `docker exec`
(`NI_TEST_MONGO_CONTAINER`, default `nimbusimage-mongodb-1`).

The task-based eval (headless Claude Code against a running server) lives in
`eval/`; see the header of `eval/run_eval.sh`.
