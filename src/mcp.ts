/**
 * browserdebug MCP server. The 26 published tools: click, drag,
 * fill, fill_form, handle_dialog, hover, press_key, upload_file,
 * close_page, list_pages, navigate_page, new_page, select_page,
 * wait_for, emulate, resize_page, performance_analyze_insight,
 * performance_start_trace, performance_stop_trace,
 * get_network_request, list_network_requests, evaluate_script,
 * get_console_message, list_console_messages, take_screenshot,
 * take_snapshot.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects two keys
 * that are not in this toolset's public spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file therefore serves tools/list with
 * the spec's exact input schemas, while zod still validates every
 * tools/call argument set.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BrowserDebug, VERSION } from "./debug.js";

const S = z.string();
const ClickArgs = z.object({ uid: S, dblClick: z.boolean().optional() });
const DragArgs = z.object({ from_uid: S, to_uid: S });
const FillArgs = z.object({ uid: S, value: S });
const FillFormArgs = z.object({ elements: z.array(z.object({ uid: S, value: S })) });
const DialogArgs = z.object({ action: S, promptText: S.optional() });
const UidArgs = z.object({ uid: S });
const PressArgs = z.object({ key: S });
const UploadArgs = z.object({ uid: S, filePath: S });
const PageIdArgs = z.object({ pageId: z.number() });
const SelectPageArgs = z.object({ pageId: z.number(), bringToFront: z.boolean().optional() });
const NavigateArgs = z.object({ type: S.optional(), url: S.optional(), ignoreCache: z.boolean().optional(), timeout: z.number().optional() });
const NewPageArgs = z.object({ url: S, background: z.boolean().optional(), timeout: z.number().optional() });
const WaitArgs = z.object({ text: z.array(S), timeout: z.number().optional() });
const EmulateArgs = z.object({ networkConditions: S.optional(), cpuThrottlingRate: z.number().optional(), geolocation: S.optional(), userAgent: S.optional(), colorScheme: S.optional() });
const ResizeArgs = z.object({ width: z.number(), height: z.number() });
const InsightArgs = z.object({ insightSetId: S, insightName: S });
const TraceStartArgs = z.object({ reload: z.boolean().optional(), autoStop: z.boolean().optional(), filePath: S.optional() });
const TraceStopArgs = z.object({ filePath: S.optional() });
const NetReqArgs = z.object({ reqid: z.number().optional() });
const NetListArgs = z.object({ pageSize: z.number().optional(), pageIdx: z.number().optional(), resourceTypes: z.array(S).optional(), includePreservedRequests: z.boolean().optional() });
const EvalArgs = z.object({ function: S, args: z.array(S).optional() });
const MsgArgs = z.object({ msgid: z.number() });
const ConsoleListArgs = z.object({ pageSize: z.number().optional(), pageIdx: z.number().optional(), types: z.array(S).optional(), includePreservedMessages: z.boolean().optional() });
const ShotArgs = z.object({ format: S.optional(), quality: z.number().optional(), uid: S.optional(), fullPage: z.boolean().optional(), filePath: S.optional() });
const SnapArgs = z.object({ verbose: z.boolean().optional(), filePath: S.optional() });
const EmptyArgs = z.object({});

const str = { type: "string" as const };
const num = { type: "number" as const };
const bool = { type: "boolean" as const };
const strArr = { type: "array" as const, items: { type: "string" } };
const TOOLS = [
  { name: "click", description: "Click on the provided element", inputSchema: { type: "object" as const, properties: { dblClick: { type: "boolean", description: "Whether to double click the element" }, uid: { type: "string", description: "The uid of the element from a page snapshot to click" } }, required: ["uid"] } },
  { name: "drag", description: "Drag an element onto another element", inputSchema: { type: "object" as const, properties: { from_uid: { type: "string", description: "The uid of the element to drag from" }, to_uid: { type: "string", description: "The uid of the element to drag onto" } }, required: ["from_uid", "to_uid"] } },
  { name: "fill", description: "Type text into an input, text area or select an option from a select element", inputSchema: { type: "object" as const, properties: { uid: { type: "string", description: "The uid of the input, text area, or select element to fill" }, value: { type: "string", description: "The text to type into the element, or the value of the option to select" } }, required: ["uid", "value"] } },
  { name: "fill_form", description: "Fill out multiple form elements at once", inputSchema: { type: "object" as const, properties: { elements: { type: "array", description: "The form elements to fill, each given as an element uid and the value to enter" } }, required: ["elements"] } },
  { name: "handle_dialog", description: "Handle a browser dialog (accept or dismiss)", inputSchema: { type: "object" as const, properties: { action: { type: "string", description: "The dialog action to take: accept or dismiss" }, promptText: { type: "string", description: "Optional text to enter into a prompt dialog before accepting it" } }, required: ["action"] } },
  { name: "hover", description: "Hover over the provided element", inputSchema: { type: "object" as const, properties: { uid: { type: "string", description: "The uid of the element from a page snapshot to hover over" } }, required: ["uid"] } },
  { name: "press_key", description: "Press a key or key combination in the browser", inputSchema: { type: "object" as const, properties: { key: { type: "string", description: "The key or key combination to press, such as Enter or Control+A" } }, required: ["key"] } },
  { name: "upload_file", description: "Upload a file through a file input element", inputSchema: { type: "object" as const, properties: { filePath: { type: "string", description: "The local path of the file to upload" }, uid: { type: "string", description: "The uid of the file input element to upload through" } }, required: ["uid", "filePath"] } },
  { name: "close_page", description: "Closes the page by its index; the last open page cannot be closed", inputSchema: { type: "object" as const, properties: { pageId: { type: "number", description: "The index of the page to close, as listed by list_pages" } }, required: ["pageId"] } },
  { name: "list_pages", description: "Get a list of pages open in the browser", inputSchema: { type: "object" as const, properties: {}, required: [] } },
  { name: "navigate_page", description: "Navigate the currently selected page to a URL, or back, forward or reload", inputSchema: { type: "object" as const, properties: { ignoreCache: { type: "boolean", description: "Whether to ignore the browser cache when reloading the page" }, timeout: { type: "number", description: "Optional navigation timeout in milliseconds" }, type: { type: "string", description: "Optional navigation type: url, back, forward, or reload" }, url: { type: "string", description: "The URL to navigate to when the navigation type is url" } }, required: [] } },
  { name: "new_page", description: "Open a new tab and load a URL", inputSchema: { type: "object" as const, properties: { background: { type: "boolean", description: "Whether to open the new tab in the background without selecting it" }, timeout: { type: "number", description: "Optional navigation timeout in milliseconds" }, url: { type: "string", description: "The URL to load in the new tab" } }, required: ["url"] } },
  { name: "select_page", description: "Select a page as the context for future tool calls", inputSchema: { type: "object" as const, properties: { bringToFront: { type: "boolean", description: "Whether to bring the selected page to the front" }, pageId: { type: "number", description: "The index of the page to select, as listed by list_pages" } }, required: ["pageId"] } },
  { name: "wait_for", description: "Wait until any of the provided texts appears on the selected page", inputSchema: { type: "object" as const, properties: { text: { type: "array", items: { type: "string" }, description: "The texts to wait for; the call returns when any one of them appears on the page" }, timeout: { type: "number", description: "Optional timeout in milliseconds to wait for the text" } }, required: ["text"] } },
  { name: "emulate", description: "Emulates network, CPU, geolocation, user agent and colour scheme features on the selected page", inputSchema: { type: "object" as const, properties: { colorScheme: { type: "string", description: "Optional colour scheme to emulate: light, dark, or auto" }, cpuThrottlingRate: { type: "number", description: "Optional CPU throttling rate; 1 means no throttling and the value must be at least 1" }, geolocation: { type: "string", description: "Optional geolocation to emulate, given as a latitude and longitude pair" }, networkConditions: { type: "string", description: "Optional network conditions preset to emulate, such as Slow 3G or Fast 3G" }, userAgent: { type: "string", description: "Optional user agent string to emulate" } }, required: [] } },
  { name: "resize_page", description: "Resizes the selected page's window so the page fits the given dimensions", inputSchema: { type: "object" as const, properties: { height: { type: "number", description: "The new window height in pixels" }, width: { type: "number", description: "The new window width in pixels" } }, required: ["width", "height"] } },
  { name: "performance_analyze_insight", description: "Provide more detailed information on a specific performance insight from a recorded trace", inputSchema: { type: "object" as const, properties: { insightName: { type: "string", description: "The name of the performance insight to analyse" }, insightSetId: { type: "string", description: "The id of the insight set from a recorded performance trace" } }, required: ["insightSetId", "insightName"] } },
  { name: "performance_start_trace", description: "Start a performance trace on the selected page", inputSchema: { type: "object" as const, properties: { autoStop: { type: "boolean", description: "Whether to stop the trace automatically once the page has loaded" }, filePath: { type: "string", description: "Optional file path to save the trace to when it stops" }, reload: { type: "boolean", description: "Whether to reload the page after starting the trace" } }, required: [] } },
  { name: "performance_stop_trace", description: "Stop the active performance trace", inputSchema: { type: "object" as const, properties: { filePath: { type: "string", description: "Optional file path to save the stopped trace to" } }, required: [] } },
  { name: "get_network_request", description: "Get a network request by its request id; without an id, the currently selected request in DevTools", inputSchema: { type: "object" as const, properties: { reqid: { type: "number", description: "Optional request id of the network request; the request currently selected in DevTools is used when omitted" } }, required: [] } },
  { name: "list_network_requests", description: "List all requests for the currently selected page since navigation", inputSchema: { type: "object" as const, properties: { includePreservedRequests: { type: "boolean", description: "Whether to include requests preserved from the previous navigation" }, pageIdx: { type: "number", description: "Optional page index of the request list to return" }, pageSize: { type: "number", description: "Optional maximum number of requests to return in one page of results" }, resourceTypes: { type: "array", items: { type: "string" }, description: "Optional list of resource types to filter the requests by" } }, required: [] } },
  { name: "evaluate_script", description: "Evaluate a JavaScript function inside the currently selected page and return its result", inputSchema: { type: "object" as const, properties: { args: { type: "array", items: { type: "string" }, description: "Optional element uids to pass to the function as its arguments" }, function: { type: "string", description: "The JavaScript function declaration to evaluate inside the selected page" } }, required: ["function"] } },
  { name: "get_console_message", description: "Get a console message by its id", inputSchema: { type: "object" as const, properties: { msgid: { type: "number", description: "The id of the console message, as listed by list_console_messages" } }, required: ["msgid"] } },
  { name: "list_console_messages", description: "List all console messages for the currently selected page since navigation", inputSchema: { type: "object" as const, properties: { includePreservedMessages: { type: "boolean", description: "Whether to include messages preserved from the previous navigation" }, pageIdx: { type: "number", description: "Optional page index of the message list to return" }, pageSize: { type: "number", description: "Optional maximum number of messages to return in one page of results" }, types: { type: "array", items: { type: "string" }, description: "Optional list of console message types to filter by, such as log, error, or warning" } }, required: [] } },
  { name: "take_screenshot", description: "Take a screenshot of the page or an element", inputSchema: { type: "object" as const, properties: { filePath: { type: "string", description: "Optional file path to save the screenshot to" }, format: { type: "string", description: "Optional image format of the screenshot: png, jpeg, or webp" }, fullPage: { type: "boolean", description: "Whether to capture the full page instead of the visible viewport" }, quality: { type: "number", description: "Optional image quality from 0 to 100, for the jpeg and webp formats" }, uid: { type: "string", description: "Optional uid of an element to screenshot instead of the page" } }, required: [] } },
  { name: "take_snapshot", description: "Take a text snapshot of the currently selected page based on the accessibility tree", inputSchema: { type: "object" as const, properties: { filePath: { type: "string", description: "Optional file path to save the snapshot to" }, verbose: { type: "boolean", description: "Whether to include verbose accessibility tree details in the snapshot" } }, required: [] } },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const debug = new BrowserDebug();
const server = new Server({ name: "browserdebug", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "click": { const p = ClickArgs.parse(args ?? {}); return textResult(await debug.click(p.uid, p.dblClick)); }
      case "drag": { const p = DragArgs.parse(args ?? {}); return textResult(await debug.drag(p.from_uid, p.to_uid)); }
      case "fill": { const p = FillArgs.parse(args ?? {}); return textResult(await debug.fill(p.uid, p.value)); }
      case "fill_form": return textResult(await debug.fillForm(FillFormArgs.parse(args ?? {}).elements));
      case "handle_dialog": { const p = DialogArgs.parse(args ?? {}); return textResult(await debug.handleDialog(p.action, p.promptText)); }
      case "hover": return textResult(await debug.hover(UidArgs.parse(args ?? {}).uid));
      case "press_key": return textResult(await debug.pressKey(PressArgs.parse(args ?? {}).key));
      case "upload_file": { const p = UploadArgs.parse(args ?? {}); return textResult(await debug.uploadFile(p.uid, p.filePath)); }
      case "close_page": return textResult(await debug.closePage(PageIdArgs.parse(args ?? {}).pageId));
      case "list_pages": EmptyArgs.parse(args ?? {}); return textResult(await debug.listPages());
      case "navigate_page": return textResult(await debug.navigatePage(NavigateArgs.parse(args ?? {})));
      case "new_page": { const p = NewPageArgs.parse(args ?? {}); return textResult(await debug.newPage(p.url, p)); }
      case "select_page": { const p = SelectPageArgs.parse(args ?? {}); return textResult(await debug.selectPage(p.pageId, p.bringToFront)); }
      case "wait_for": { const p = WaitArgs.parse(args ?? {}); return textResult(await debug.waitFor(p.text, p.timeout)); }
      case "emulate": return textResult(await debug.emulate(EmulateArgs.parse(args ?? {})));
      case "resize_page": { const p = ResizeArgs.parse(args ?? {}); return textResult(await debug.resizePage(p.width, p.height)); }
      case "performance_analyze_insight": { const p = InsightArgs.parse(args ?? {}); return textResult(await debug.analyzeInsight(p.insightSetId, p.insightName)); }
      case "performance_start_trace": return textResult(await debug.startTrace(TraceStartArgs.parse(args ?? {})));
      case "performance_stop_trace": return textResult(await debug.stopTrace(TraceStopArgs.parse(args ?? {}).filePath));
      case "get_network_request": return textResult(await debug.getNetworkRequest(NetReqArgs.parse(args ?? {}).reqid));
      case "list_network_requests": return textResult(await debug.listNetworkRequests(NetListArgs.parse(args ?? {})));
      case "evaluate_script": { const p = EvalArgs.parse(args ?? {}); return textResult(await debug.evaluateScript(p.function, p.args)); }
      case "get_console_message": return textResult(await debug.getConsoleMessage(MsgArgs.parse(args ?? {}).msgid));
      case "list_console_messages": return textResult(await debug.listConsoleMessages(ConsoleListArgs.parse(args ?? {})));
      case "take_screenshot": return textResult(await debug.takeScreenshot(ShotArgs.parse(args ?? {})));
      case "take_snapshot": return textResult(await debug.takeSnapshot(SnapArgs.parse(args ?? {})));
    }
  } catch (err) { return errorResult(err); }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> { await server.connect(new StdioServerTransport()); }
void main();
