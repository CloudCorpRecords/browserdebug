/**
 * browserdebug core: the 26 published Chrome DevTools-style tools
 * over an injectable DebugBrowser.
 *
 * The core owns what does not need a browser: uid and page-id
 * validation, the dialog action whitelist, wait_for's non-empty
 * text list, fill_form's non-empty rule, screenshot format
 * validation, and the performance-trace state machine - a trace
 * must be started before it can be stopped or analysed, and cannot
 * be started twice. Everything else delegates to the executor.
 *
 * The default browser bundles nothing and downloads nothing: each
 * call fails with a clear error, the honest failure the original
 * server gives when Chrome cannot be launched or connected.
 */
import type {
  ConsoleListOptions, DebugBrowser, EmulateOptions, FormElement,
  NavigateOptions, NetworkListOptions, NewPageOptions, ScreenshotOptions,
  SnapshotOptions, TraceStartOptions,
} from "./types.js";

export const VERSION = "0.1.0";

const UNAVAILABLE = "Browser unavailable: browserdebug bundles no browser and downloads none. Inject a DevTools-compatible DebugBrowser, or run in an environment that provides one.";

export class UnavailableDebugBrowser implements DebugBrowser {
  private fail(): never { throw new Error(UNAVAILABLE); }
  async click(): Promise<string> { return this.fail(); }
  async drag(): Promise<string> { return this.fail(); }
  async fill(): Promise<string> { return this.fail(); }
  async fillForm(): Promise<string> { return this.fail(); }
  async handleDialog(): Promise<string> { return this.fail(); }
  async hover(): Promise<string> { return this.fail(); }
  async pressKey(): Promise<string> { return this.fail(); }
  async uploadFile(): Promise<string> { return this.fail(); }
  async closePage(): Promise<string> { return this.fail(); }
  async listPages(): Promise<unknown> { return this.fail(); }
  async navigatePage(): Promise<string> { return this.fail(); }
  async newPage(): Promise<string> { return this.fail(); }
  async selectPage(): Promise<string> { return this.fail(); }
  async waitFor(): Promise<string> { return this.fail(); }
  async emulate(): Promise<string> { return this.fail(); }
  async resizePage(): Promise<string> { return this.fail(); }
  async analyzeInsight(): Promise<unknown> { return this.fail(); }
  async startTrace(): Promise<string> { return this.fail(); }
  async stopTrace(): Promise<unknown> { return this.fail(); }
  async getNetworkRequest(): Promise<unknown> { return this.fail(); }
  async listNetworkRequests(): Promise<unknown> { return this.fail(); }
  async evaluateScript(): Promise<unknown> { return this.fail(); }
  async getConsoleMessage(): Promise<unknown> { return this.fail(); }
  async listConsoleMessages(): Promise<unknown> { return this.fail(); }
  async takeScreenshot(): Promise<string> { return this.fail(); }
  async takeSnapshot(): Promise<string> { return this.fail(); }
}

const DIALOG_ACTIONS = ["accept", "dismiss"];
const SCREENSHOT_FORMATS = ["png", "jpeg", "webp"];
const NAV_TYPES = ["url", "back", "forward", "reload"];

export class BrowserDebug {
  private readonly browser: DebugBrowser;
  private tracing = false;
  private traceFilePath: string | undefined;
  constructor(browser: DebugBrowser = new UnavailableDebugBrowser()) { this.browser = browser; }
  get isTracing(): boolean { return this.tracing; }

  private uid(uid: string): string {
    if (!uid) throw new Error("uid is required");
    return uid;
  }
  private pageId(pageId: number): number {
    if (!Number.isInteger(pageId) || pageId < 0) throw new Error("pageId must be a non-negative integer");
    return pageId;
  }

  async click(uid: string, dblClick?: boolean): Promise<string> { return this.browser.click(this.uid(uid), dblClick); }
  async drag(fromUid: string, toUid: string): Promise<string> { return this.browser.drag(this.uid(fromUid), this.uid(toUid)); }
  async fill(uid: string, value: string): Promise<string> { return this.browser.fill(this.uid(uid), value); }
  async fillForm(elements: FormElement[]): Promise<string> {
    if (!elements || elements.length === 0) throw new Error("elements must list at least one form element");
    for (const el of elements) this.uid(el.uid);
    return this.browser.fillForm(elements);
  }
  async handleDialog(action: string, promptText?: string): Promise<string> {
    if (!DIALOG_ACTIONS.includes(action)) throw new Error(`action must be one of ${DIALOG_ACTIONS.join(", ")}; got: ${action}`);
    return this.browser.handleDialog(action, promptText);
  }
  async hover(uid: string): Promise<string> { return this.browser.hover(this.uid(uid)); }
  async pressKey(key: string): Promise<string> {
    if (!key) throw new Error("key is required");
    return this.browser.pressKey(key);
  }
  async uploadFile(uid: string, filePath: string): Promise<string> {
    if (!filePath) throw new Error("filePath is required");
    return this.browser.uploadFile(this.uid(uid), filePath);
  }
  async closePage(pageId: number): Promise<string> { return this.browser.closePage(this.pageId(pageId)); }
  async listPages(): Promise<unknown> { return this.browser.listPages(); }
  async navigatePage(opts: NavigateOptions): Promise<string> {
    if (opts.type !== undefined && !NAV_TYPES.includes(opts.type)) {
      throw new Error(`navigate type must be one of ${NAV_TYPES.join(", ")}; got: ${opts.type}`);
    }
    if ((opts.type === undefined || opts.type === "url") && !opts.url) {
      throw new Error("url is required when navigating to a URL");
    }
    return this.browser.navigatePage(opts);
  }
  async newPage(url: string, opts: NewPageOptions = {}): Promise<string> {
    if (!url) throw new Error("url is required");
    return this.browser.newPage(url, opts);
  }
  async selectPage(pageId: number, bringToFront?: boolean): Promise<string> { return this.browser.selectPage(this.pageId(pageId), bringToFront); }
  async waitFor(text: string[], timeout?: number): Promise<string> {
    if (!text || text.length === 0) throw new Error("text must list at least one string to wait for");
    return this.browser.waitFor(text, timeout);
  }
  async emulate(opts: EmulateOptions): Promise<string> {
    if (opts.cpuThrottlingRate !== undefined && opts.cpuThrottlingRate < 1) {
      throw new Error("cpuThrottlingRate must be >= 1");
    }
    return this.browser.emulate(opts);
  }
  async resizePage(width: number, height: number): Promise<string> {
    if (width <= 0 || height <= 0) throw new Error("width and height must be > 0");
    return this.browser.resizePage(width, height);
  }
  async analyzeInsight(insightSetId: string, insightName: string): Promise<unknown> {
    if (!insightSetId) throw new Error("insightSetId is required (record a trace first)");
    if (!insightName) throw new Error("insightName is required");
    return this.browser.analyzeInsight(insightSetId, insightName);
  }
  async startTrace(opts: TraceStartOptions = {}): Promise<string> {
    if (this.tracing) throw new Error("A performance trace is already running; stop it before starting another");
    const msg = await this.browser.startTrace(opts);
    this.tracing = true;
    this.traceFilePath = opts.filePath;
    return msg;
  }
  async stopTrace(filePath?: string): Promise<unknown> {
    if (!this.tracing) throw new Error("No performance trace is running");
    const result = await this.browser.stopTrace(filePath ?? this.traceFilePath);
    this.tracing = false;
    this.traceFilePath = undefined;
    return result;
  }
  async getNetworkRequest(reqid?: number): Promise<unknown> {
    if (reqid !== undefined && (!Number.isInteger(reqid) || reqid < 0)) throw new Error("reqid must be a non-negative integer");
    return this.browser.getNetworkRequest(reqid);
  }
  async listNetworkRequests(opts: NetworkListOptions = {}): Promise<unknown> { return this.browser.listNetworkRequests(opts); }
  async evaluateScript(fn: string, args?: string[]): Promise<unknown> {
    if (!fn) throw new Error("function is required");
    return this.browser.evaluateScript(fn, args);
  }
  async getConsoleMessage(msgid: number): Promise<unknown> {
    if (!Number.isInteger(msgid) || msgid < 0) throw new Error("msgid must be a non-negative integer");
    return this.browser.getConsoleMessage(msgid);
  }
  async listConsoleMessages(opts: ConsoleListOptions = {}): Promise<unknown> { return this.browser.listConsoleMessages(opts); }
  async takeScreenshot(opts: ScreenshotOptions = {}): Promise<string> {
    if (opts.format !== undefined && !SCREENSHOT_FORMATS.includes(opts.format)) {
      throw new Error(`format must be one of ${SCREENSHOT_FORMATS.join(", ")}; got: ${opts.format}`);
    }
    if (opts.quality !== undefined && (opts.quality < 0 || opts.quality > 100)) {
      throw new Error("quality must be between 0 and 100");
    }
    return this.browser.takeScreenshot(opts);
  }
  async takeSnapshot(opts: SnapshotOptions = {}): Promise<string> { return this.browser.takeSnapshot(opts); }
}
