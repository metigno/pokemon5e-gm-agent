import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const SCENES = new URL("../content/scenes/", import.meta.url);
const UNEXPOSED = /\\bWORLD_EXIT\\b|\\bfree[ -]roam\\b|\\bcommit(?: guard)?\\b|\\bstato persistente\\b|\\{\\{world\\.flags\\./i;

test("authored choices and narration never expose internal engine vocabulary", async () => {
  const failures = [];
  for (const name of (await readdir(SCENES)).filter((entry) => entry.endsWith(".json"))) {
    const scene = JSON.parse(await readFile(new URL(name, SCENES), "utf8"));
    function walk(value, where = "scene") {
      if (!value || typeof value !== "object") return;
      for (const [key, entry] of Object.entries(value)) {
        const at = `${where}.${key}`;
        if (key === "text" && typeof entry === "string" && UNEXPOSED.test(entry)) {
          failures.push(`${name} ${at}: ${entry.slice(0, 110)}`);
        } else if (entry && typeof entry === "object") {
          walk(entry, at);
        }
      }
    }
    walk(scene);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
