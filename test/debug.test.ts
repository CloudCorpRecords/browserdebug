import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BrowserDebug } from "../src/debug.js";
import type { DebugBrowser } from "../src/types.js";

class FakeDebug implements DebugBrowser {
  calls: string[] = [];
  async click(uid: string) { this.calls.push(`click:${uid}`); return "Clicked"; }
  async drag(a: string, b: string) { this.calls.push(`drag:${a}->${b}`); return "Dragged"; }
  async fill(uid: string, v: string) { this.calls.push(`fill:${uid}=${v}`); return "Filled"; }
  async fillForm(e: unknown[]) { this.calls.push(`fillForm:${e.length}`); return "Form filled"; }
  async handleDialog(a: string) { this.calls.push(`dialog:${a}`); return "Handled"; }
  async hover(uid: string) { this.calls.push(`hover:${uid}`); return "Hovered"; }
  async pressKey(k: string) { this.calls.push(`press:${k}`); return "Pressed"; }
  async uploadFile(uid: string, f: string) { this.calls.push(`upload:${uid}:${f}`); return "Uploaded"; }
  async closePage(id: number) { this.calls.push(`close:${id}`); return "Closed"; }
  async listPages() { this.calls.push("pages"); return [{ pageId: 0, url: "https://x.test/" }]; }
  async navigatePage(o: { url?: string }) { this.calls.push(`nav:${o.url ?? ""}`); return "Navigated"; }
  async newPage(url: string) { this.calls.push(`new:${url}`); return "Opened"; }
  async selectPage(id: number) { this.calls.push(`select:${id}`); return "Selected"; }
  async waitFor(t: string[]) { this.calls.push(`wait:${t.join("|")}`); return "Found"; }
  async emulate() { this.calls.push("emulate"); return "Emulated"; }
  async resizePage(w: number, h: number) { this.calls.push(`resize:${w}x${h}`); return "Resized"; }
  async analyzeInsight() { this.calls.push("insight"); return { insight: "LCP", detail: "ok" }; }
  async startTrace() { this.calls.push("trace:start"); return "Trace started"; }
  async stopTrace() { this.calls.push("trace:stop"); return { insightSetId: "set-1" }; }
  async getNetworkRequest(id?: number) { this.calls.push(`netreq:${id}`); return { reqid: id ?? 0, status: 200 }; }
  async listNetworkRequests() { this.calls.push("netlist"); return [{ reqid: 1 }]; }
  async evaluateScript() { this.calls.push("eval"); return 7; }
  async getConsoleMessage(id: number) { this.calls.push(`msg:${id}`); return { msgid: id, text: "hello" }; }
  async listConsoleMessages() { this.calls.push("msgs"); return [{ msgid: 1 }]; }
  async takeScreenshot() { this.calls.push("shot"); return "Screenshot saved"; }
  async takeSnapshot() { this.calls.push("snap"); return "- heading \"Home\""; }
}

describe("browserdebug core", () => {
  it("input tools delegate with uid validation", async () => {
    const fake = new FakeDebug(); const d = new BrowserDebug(fake);
    assert.equal(await d.click("e1", true), "Clicked");
    assert.equal(await d.drag("e1", "e2"), "Dragged");
    assert.equal(await d.fill("e3", "text"), "Filled");
    assert.equal(await d.hover("e4"), "Hovered");
    assert.equal(await d.pressKey("Enter"), "Pressed");
    assert.equal(await d.uploadFile("e5", "/tmp/f.png"), "Uploaded");
    await assert.rejects(() => d.click(""), /uid is required/);
    await assert.rejects(() => d.pressKey(""), /key is required/);
    await assert.rejects(() => d.uploadFile("e5", ""), /filePath is required/);
  });
  it("fillForm needs at least one element, each with a uid", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.equal(await d.fillForm([{ uid: "e1", value: "a" }]), "Form filled");
    await assert.rejects(() => d.fillForm([]), /at least one form element/);
    await assert.rejects(() => d.fillForm([{ uid: "", value: "a" }]), /uid is required/);
  });
  it("handleDialog whitelists accept/dismiss", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.equal(await d.handleDialog("accept"), "Handled");
    assert.equal(await d.handleDialog("dismiss", undefined), "Handled");
    await assert.rejects(() => d.handleDialog("ignore"), /must be one of/);
  });
  it("page tools validate page ids and navigation types", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.deepEqual(await d.listPages(), [{ pageId: 0, url: "https://x.test/" }]);
    assert.equal(await d.newPage("https://x.test/"), "Opened");
    assert.equal(await d.selectPage(0), "Selected");
    assert.equal(await d.closePage(1), "Closed");
    await assert.rejects(() => d.closePage(-1), /non-negative integer/);
    assert.equal(await d.navigatePage({ type: "reload" }), "Navigated");
    await assert.rejects(() => d.navigatePage({ type: "sideways" }), /must be one of/);
    await assert.rejects(() => d.navigatePage({}), /url is required/);
  });
  it("waitFor needs at least one text", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.equal(await d.waitFor(["Done", "Ready"]), "Found");
    await assert.rejects(() => d.waitFor([]), /at least one string/);
  });
  it("emulate and resizePage validate their numbers", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.equal(await d.emulate({ networkConditions: "Fast 3G" }), "Emulated");
    await assert.rejects(() => d.emulate({ cpuThrottlingRate: 0 }), />= 1/);
    assert.equal(await d.resizePage(800, 600), "Resized");
    await assert.rejects(() => d.resizePage(0, 600), /> 0/);
  });
  it("the trace state machine: stop/analyse need a trace, no double start", async () => {
    const d = new BrowserDebug(new FakeDebug());
    await assert.rejects(() => d.stopTrace(), /No performance trace is running/);
    assert.equal(await d.startTrace({ reload: true }), "Trace started");
    assert.equal(d.isTracing, true);
    await assert.rejects(() => d.startTrace(), /already running/);
    assert.deepEqual(await d.stopTrace(), { insightSetId: "set-1" });
    assert.equal(d.isTracing, false);
    assert.deepEqual(await d.analyzeInsight("set-1", "LCP"), { insight: "LCP", detail: "ok" });
    await assert.rejects(() => d.analyzeInsight("", "LCP"), /insightSetId is required/);
  });
  it("network and console tools validate ids and delegate", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.deepEqual(await d.getNetworkRequest(3), { reqid: 3, status: 200 });
    assert.deepEqual(await d.listNetworkRequests({ pageSize: 10 }), [{ reqid: 1 }]);
    await assert.rejects(() => d.getNetworkRequest(-2), /non-negative integer/);
    assert.deepEqual(await d.getConsoleMessage(1), { msgid: 1, text: "hello" });
    assert.deepEqual(await d.listConsoleMessages({ types: ["error"] }), [{ msgid: 1 }]);
    await assert.rejects(() => d.getConsoleMessage(1.5), /non-negative integer/);
  });
  it("evaluateScript needs a function; screenshot validates format and quality", async () => {
    const d = new BrowserDebug(new FakeDebug());
    assert.equal(await d.evaluateScript("() => 7"), 7);
    await assert.rejects(() => d.evaluateScript(""), /function is required/);
    assert.equal(await d.takeScreenshot({ format: "jpeg", quality: 80 }), "Screenshot saved");
    await assert.rejects(() => d.takeScreenshot({ format: "tiff" }), /must be one of/);
    await assert.rejects(() => d.takeScreenshot({ quality: 101 }), /between 0 and 100/);
    assert.match(await d.takeSnapshot({ verbose: true }), /heading/);
  });
  it("the default browser fails honestly with no browser configured", async () => {
    const d = new BrowserDebug();
    await assert.rejects(() => d.listPages(), /Browser unavailable/);
    await assert.rejects(() => d.takeSnapshot(), /Browser unavailable/);
  });
});
