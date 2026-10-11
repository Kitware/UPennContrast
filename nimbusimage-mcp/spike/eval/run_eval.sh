#!/usr/bin/env bash
# Run every task in tasks.txt through headless Claude Code against the spike
# server (must already be running on 127.0.0.1:8000), in parallel, then
# summarize tool choice, turns, cost, and answers.
#
# Start the server with a fresh call log (NI_MCP_CALL_LOG=<new file>) so the
# eval's sizes and latencies are not mixed with earlier calls.
#
# Only the nimbus MCP tools are allowed, and user/project settings are not
# loaded, so Claude cannot fall back to the nimbusimage skills or Bash.
set -euo pipefail
EVAL="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"   # neutral cwd: no CLAUDE.md, no repo context
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$EVAL/runs"
rm -f "$EVAL"/runs/*.jsonl

i=0
pids=()
while IFS= read -r task; do
  i=$((i + 1))
  # </dev/null matters: claude -p appends piped stdin to the prompt, which
  # would otherwise hand the rest of tasks.txt to the first session.
  (cd "$WORK" && claude -p "$task" \
      --mcp-config "$EVAL/mcp.json" --strict-mcp-config \
      --setting-sources "" \
      --allowedTools "mcp__nimbus" \
      --disallowedTools "Bash Read Write Edit Glob Grep WebFetch WebSearch Agent NotebookEdit Skill" \
      --output-format stream-json --verbose --max-turns 15 \
      < /dev/null > "$EVAL/runs/task$(printf %02d "$i").jsonl" 2>&1) &
  pids+=("$!")
done < "$EVAL/tasks.txt"

failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=$((failed + 1)); done
[ "$failed" -eq 0 ] || echo "WARNING: $failed claude run(s) exited non-zero" >&2

cd "$EVAL" && python3 summarize.py
