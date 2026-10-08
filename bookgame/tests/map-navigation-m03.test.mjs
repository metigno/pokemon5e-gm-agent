import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { mapIllustrationForLocation, mapIllustrationFormat } from "../src/assets/map-illustrations.mjs";

test("M03 Cava Grigia, Ferravia and Ferrox use real local images for all scripted locations", async () => {
  const directory = new URL("../content/scenes/", import.meta.url);
  const names = (await readdir(directory)).filter((name) =>
    name.startsWith("m03-") && name.endsWith(".json"));
  assert.equal(names.length, 15);
  const ids = new Set();
  function scan(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(scan);
    if (value.type === "set_location") ids.add(value.locationId);
    for (const nested of Object.values(value)) if (nested && typeof nested === "object") scan(nested);
  }
  for (const name of names) {
    const data = JSON.parse(await readFile(new URL(name, directory), "utf8"));
    if (data.locationId) ids.add(data.locationId);
    scan(data.nodes);
  }
  assert.equal(ids.size, 17);
  for (const id of ids) {
    const art = mapIllustrationForLocation(id);
    const ext = mapIllustrationFormat(art);
    assert.ok(art && ext, `missing M03 art: ${id}`);
    const bytes = await readFile(new URL(`../assets/maps/illustrations/${art}.${ext}`, import.meta.url));
    if (ext === "png") assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    else {
      const image = bytes.toString("utf8");
      assert.ok(image.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
      assert.ok(image.trimEnd().endsWith("</svg>"));
      assert.ok(!/<script|onload=|javascript:/i.test(image));
    }
  }
  assert.equal(mapIllustrationForLocation("ast_quarry"), "m03-quarry");
  assert.equal(mapIllustrationForLocation("fer_city"), "m03-ferravia");
  assert.equal(mapIllustrationForLocation("ferrox_access"), "m03-ferrox");
  assert.equal(mapIllustrationForLocation("borgo_salice"), "m02-borgo-salice");
  assert.equal(mapIllustrationForLocation("unknown_asteria_city"), null);
});
