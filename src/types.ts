/**
 * browserdebug types.
 *
 * Every tool talks to the browser only through the DebugBrowser
 * interface, so the whole surface is exercisable with a fake
 * browser in tests. The default executor (in debug.ts) bundles no
 * browser and downloads none: it fails every call with a clear
 * "no browser configured" error.
 */

export interface FormElement { uid: string; value: string }
export interface NavigateOptions { type?: string; url?: string; ignoreCache?: boolean; timeout?: number }
export interface NewPageOptions { background?: boolean; timeout?: number }
export interface EmulateOptions {
  networkConditions?: string;
  cpuThrottlingRate?: number;
  geolocation?: string;
  userAgent?: string;
  colorScheme?: string;
}
export interface TraceStartOptions { reload?: boolean; autoStop?: boolean; filePath?: string }
export interface ListOptions { pageSize?: number; pageIdx?: number }
export interface NetworkListOptions extends ListOptions {
  resourceTypes?: string[];
  includePreservedRequests?: boolean;
}
export interface ConsoleListOptions extends ListOptions {
  types?: string[];
  includePreservedMessages?: boolean;
}
export interface ScreenshotOptions { format?: string; quality?: number; uid?: string; fullPage?: boolean; filePath?: string }
export interface SnapshotOptions { verbose?: boolean; filePath?: string }

/** A DevTools-style page driver: elements are addressed by uid. */
export interface DebugBrowser {
  click(uid: string, dblClick?: boolean): Promise<string>;
  drag(fromUid: string, toUid: string): Promise<string>;
  fill(uid: string, value: string): Promise<string>;
  fillForm(elements: FormElement[]): Promise<string>;
  handleDialog(action: string, promptText?: string): Promise<string>;
  hover(uid: string): Promise<string>;
  pressKey(key: string): Promise<string>;
  uploadFile(uid: string, filePath: string): Promise<string>;
  closePage(pageId: number): Promise<string>;
  listPages(): Promise<unknown>;
  navigatePage(opts: NavigateOptions): Promise<string>;
  newPage(url: string, opts: NewPageOptions): Promise<string>;
  selectPage(pageId: number, bringToFront?: boolean): Promise<string>;
  waitFor(text: string[], timeout?: number): Promise<string>;
  emulate(opts: EmulateOptions): Promise<string>;
  resizePage(width: number, height: number): Promise<string>;
  analyzeInsight(insightSetId: string, insightName: string): Promise<unknown>;
  startTrace(opts: TraceStartOptions): Promise<string>;
  stopTrace(filePath?: string): Promise<unknown>;
  getNetworkRequest(reqid?: number): Promise<unknown>;
  listNetworkRequests(opts: NetworkListOptions): Promise<unknown>;
  evaluateScript(fn: string, args?: string[]): Promise<unknown>;
  getConsoleMessage(msgid: number): Promise<unknown>;
  listConsoleMessages(opts: ConsoleListOptions): Promise<unknown>;
  takeScreenshot(opts: ScreenshotOptions): Promise<string>;
  takeSnapshot(opts: SnapshotOptions): Promise<string>;
}
