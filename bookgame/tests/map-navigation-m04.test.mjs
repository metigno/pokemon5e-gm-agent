import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { mapIllustrationForLocation, mapIllustrationFormat } from "../src/assets/map-illustrations.mjs";

test("M04 coastal and Mareasale authored map IDs resolve only to offline approved images", async () => {
  const base = new URL("../content/scenes/", import.meta.url);
  const files = (await readdir(base)).filter((s) => s.startsWith("m04-") && s.endsWith(".json"));
  assert.equal(files.length, 15);
  const ids = new Set();
  function find(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(find);
    if (value.type === "set_location") ids.add(value.locationId);
    for (const x of Object.values(value)) if (x && typeof x === "object") find(x);
  }
  for (const file of files) {
    const scene = JSON.parse(await readFile(new URL(file, base), "utf8"));
    if (scene.locationId) ids.add(scene.locationId);
    find(scene.nodes);
  }
  assert.equal(ids.size, 14);
  for (const id of ids) {
    const illustration = mapIllustrationForLocation(id), ext = mapIllustrationFormat(illustration);
    assert.ok(illustration && ext, `M04 location art absent: ${id}`);
    const image = await readFile(new URL(`../assets/maps/illustrations/${illustration}.${ext}`, import.meta.url));
    if (ext === "png") assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    else {
      const text = image.toString("utf8");
      assert.ok(text.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
      assert.ok(text.trimEnd().endsWith("</svg>"));
      assert.ok(!/<script|onload=|javascript:/i.test(text));
    }
  }
  assert.equal(mapIllustrationForLocation("fer_city"), "m03-ferravia");
  assert.equal(mapIllustrationForLocation("mar_city"), "m04-mareasale");
  assert.equal(mapIllustrationForLocation("sal_coast"), "m04-coast");
  assert.equal(mapIllustrationForLocation("mar_reef_approach"), "m04-reef");
  assert.equal(mapIllustrationForLocation("noncanonical_island"), null);
});
