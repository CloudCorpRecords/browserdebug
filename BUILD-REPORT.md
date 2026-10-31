# browserdebug — Build Report

MCP Rebuild 100, Wave 1 Batch 5 (final Tier A batch). Clean-room
rebuild of the "chrome-devtools-mcp" target from its published
tool documentation (category tool lists). Local build only —
nothing pushed or published.

Identity: repo `browserdebug`, npm `@reneturcios/browserdebug`,
MCP name `io.github.CloudCorpRecords/browserdebug`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `browserdebug: dist/cli.js`, `mcpName` set
- `server.json` — description = **88 chars** (≤100 ✓, verified
  programmatically); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/browserdebug:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/browserdebug"`
- `tsconfig.json`, `.gitignore`, `LICENSE` (MIT), `README.md`,
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/debug.ts` (core + injectable browser interface)
- `test/debug.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`

## Implementation notes

- Twenty-six MCP tools across the documented categories: input
  (click, drag, fill, fill_form, handle_dialog, hover, press_key,
  upload_file), navigation (close_page, list_pages, navigate_page,
  new_page, select_page, wait_for), emulation (emulate,
  resize_page), performance (performance_analyze_insight,
  performance_start_trace, performance_stop_trace), network
  (get_network_request, list_network_requests), debugging
  (evaluate_script, get_console_message, list_console_messages,
  take_screenshot, take_snapshot).
- **Low-level Server API** with explicit inputSchema literals (not
  McpServer+zod — standing rule). Zod validates `tools/call` args.
- **Browser behind an injectable interface:** all logic runs
  against a `DebugBrowser` interface. The core owns the
  performance-trace state machine (stop/analyse require a running
  trace; a second start is rejected), the dialog action whitelist
  (`accept`/`dismiss`), the screenshot format whitelist
  (`png`/`jpeg`/`webp`) with quality range 0–100, and the navigate
  type whitelist. The default executor fails honestly ("Browser
  unavailable… bundles no browser and downloads none"); behaviour
  is covered by fakes in the unit tests.

## Verification (exact outputs)

- Build: `tsc` exit 0; canonical `dist/` present with `.d.ts` /
  `.js.map`. (Mid-batch the VM write guard truncated an earlier
  dist; stock `tsc` was re-run after the guard lifted and parity +
  tests re-verified against the canonical dist.)
- Tests: `tsx --test` → tests 10, pass 10, fail 0.
- CLI smoke: `node dist/cli.js --version` → `0.1.0`.
- Parity: verdict **PASS**, parity_pct **100.0**, identical_tools
  **26/26**, schema_diffs {} (`parity-out/parity.json`, re-run
  2026-10-26T17:03:13Z against canonical dist). Original side:
  tools-file fixture
  `harness/fixtures/chrome-devtools-mcp-tools-original.json`
  (docs-derived, labelled in its `_source`).

## Lockfile status

`package-lock.json` copied from pdfport with identity fields edited
(top-level `name`, root package `name`, bin key). Clean lockfile
regeneration is REQUIRED before publish — Blocker 3 in
SCOREBOARD.md. `node_modules` is a local `cp -a` copy; gitignored.

## Blockers / honest gaps

- **No live browser session was run** (browser downloads fail in
  this VM); behaviour is proven with fake executors only, and
  ground truth is docs-derived from the published category lists,
  not hand-probed.
- Container build not exercised locally; the publish-container
  workflow smoke-tests initialize/usage at publish time.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run — publish
  wave scope, not claimed here.
