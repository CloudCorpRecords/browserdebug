#!/usr/bin/env node
/**
 * browserdebug CLI.
 *
 *   browserdebug mcp
 *   browserdebug pages
 *   browserdebug navigate <url>
 *   browserdebug snapshot
 *   browserdebug screenshot [file]
 *   browserdebug --version
 *
 * Exit codes: 0 success, 1 browser error, 2 usage error. Without a
 * configured browser executor the browser commands fail with the
 * core's "Browser unavailable" message (exit 1), never a fake page.
 */
import { BrowserDebug, VERSION } from "./debug.js";

function usage(): never {
  console.error(`Usage:
  browserdebug mcp
  browserdebug pages
  browserdebug navigate <url>
  browserdebug snapshot
  browserdebug screenshot [file]
  browserdebug --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd) usage();
  try {
    const debug = new BrowserDebug();
    if (cmd === "pages") {
      console.log(JSON.stringify(await debug.listPages(), null, 2));
    } else if (cmd === "navigate") {
      const [url] = rest; if (!url) usage();
      console.log(await debug.navigatePage({ type: "url", url }));
    } else if (cmd === "snapshot") {
      console.log(await debug.takeSnapshot());
    } else if (cmd === "screenshot") {
      console.log(await debug.takeScreenshot({ filePath: rest[0] }));
    } else usage();
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
