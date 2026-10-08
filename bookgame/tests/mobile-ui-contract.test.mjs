import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../ui/public/${file}`, import.meta.url), "utf8");

test("mobile UI keeps six touch navigation destinations and accessible overlays", async () => {
  const html = await read("index.html");
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.equal([...html.matchAll(/<button data-panel="/g)].length, 6);
  assert.match(html, /id="main-view"[^>]*tabindex="-1"/);
  assert.match(html, /id="app-alert"[^>]*role="alert"/);
  assert.match(html, /id="start-error"[^>]*role="alert"/);
  assert.match(html, /id="drawer"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*inert/);
  assert.match(html, /id="reference-overlay"/);
  assert.match(html, /id="choice-overlay"/);
  assert.match(html, /href="#main-view"/);
});

test("mobile UI has narrow-viewport, safe-area, touch, and reduced-motion rules", async () => {
  const css = await read("styles.css");
  assert.match(css, /\/\* STEP12_MOBILE_POLISH:/);
  assert.match(css, /@media \(max-width: 480px\)\s*\{/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 350px\)/);
  assert.match(css, /@media \(max-height: 610px\)/);
  assert.match(css, /--mobile-nav-height: 124px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.move-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
});

test("mobile UI does not hide failures behind the Story view and traps modal focus", async () => {
  const app = await read("app.mjs");
  const errorHandler = app.match(/function showInlineError\(message\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(errorHandler, "action errors must have a shared handler");
  assert.match(errorHandler, /els\.appAlert\.textContent/);
  assert.match(errorHandler, /els\.appAlert\.hidden = false/);
  assert.doesNotMatch(errorHandler, /els\.lastRoll/);
  assert.match(app, /els\.appShell\.inert = true/);
  assert.match(app, /els\.drawer\.inert = false/);
  assert.match(app, /els\.drawer\.inert = true/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(app, /event\.key !== "Tab"/);
  assert.match(app, /referenceReturnFocus/);
  assert.match(app, /drawerReturnFocus/);
});
