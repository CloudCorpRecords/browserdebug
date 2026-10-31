# browserdebug

Chrome DevTools-style debugging as a CLI and a stdio MCP server in
one bin. Record performance traces and read their insights, list
and inspect network requests, read console messages, take text
snapshots and screenshots, emulate network/CPU/device conditions,
and drive page input by element uid.

The browser sits behind an injectable executor interface
(`DebugBrowser` in `src/types.ts`). This package bundles no browser
and downloads none: with no executor configured, browser commands
fail with a clear "Browser unavailable" error. Deployments inject
a DevTools-protocol-compatible executor to drive a real Chrome.
The performance-trace state machine lives in the core: a trace
must be started before it can be stopped, and cannot be started
twice.

## Install

```bash
npx -y @reneturcios/browserdebug mcp
```

## CLI

```bash
browserdebug mcp
browserdebug pages
browserdebug navigate <url>
browserdebug snapshot
browserdebug screenshot [file]
browserdebug --version
```

Exit codes: 0 success, 1 browser error, 2 usage error.

## MCP tools

26 tools: `click`, `drag`, `fill`, `fill_form`, `handle_dialog`,
`hover`, `press_key`, `upload_file`, `close_page`, `list_pages`,
`navigate_page`, `new_page`, `select_page`, `wait_for`, `emulate`,
`resize_page`, `performance_analyze_insight`,
`performance_start_trace`, `performance_stop_trace`,
`get_network_request`, `list_network_requests`, `evaluate_script`,
`get_console_message`, `list_console_messages`, `take_screenshot`,
`take_snapshot`.

MCP client config:

```json
{
  "mcpServers": {
    "browserdebug": {
      "command": "npx",
      "args": ["-y", "@reneturcios/browserdebug", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/browserdebug          # MCP server
docker run --rm ghcr.io/cloudcorprecords/browserdebug --version
```

## Development

```bash
npm install
npm run build
npm test
```

MIT license.
