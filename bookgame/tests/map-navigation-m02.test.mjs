import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { mapIllustrationForLocation, mapIllustrationFormat } from "../src/assets/map-illustrations.mjs";

test("all playable M02 authored locations have real allowlisted offline map art", async () => {
  const directory = new URL("../content/scenes/", import.meta.url);
  const names = (await readdir(directory)).filter((name) =>
    name.startsWith("m02-") && name.endsWith(".json"));
  assert.ok(names.length >= 15, "M02 scene census unexpectedly shrank");
  const ids = new Set();
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (value.type === "set_location") ids.add(value.locationId);
    for (const sub of Object.values(value)) if (sub && typeof sub === "object") visit(sub);
  }
  for (const name of names) {
    const scene = JSON.parse(await readFile(new URL(name, directory), "utf8"));
    if (scene.locationId) ids.add(scene.locationId);
    visit(scene.nodes);
  }
  assert.equal(ids.size, 9, "New authored M02 locations must be audited deliberately");
  for (const id of ids) {
    const art = mapIllustrationForLocation(id);
    const ext = mapIllustrationFormat(art);
    assert.ok(art && ext, `No approved art for M02 location: ${id}`);
    const file = await readFile(new URL(`../assets/maps/illustrations/${art}.${ext}`, import.meta.url));
    if (ext === "png") assert.equal(file.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    else {
      const text = file.toString("utf8");
      assert.ok(text.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
      assert.ok(text.trimEnd().endsWith("</svg>"));
      assert.ok(!/<script|onload=|javascript:/i.test(text));
    }
  }
  assert.equal(mapIllustrationForLocation("asteria_mistwood"), "m01-mistwood");
  assert.equal(mapIllustrationForLocation("valedarsena_city"), "m01-valedarsena");
  assert.equal(mapIllustrationForLocation("borgo_salice"), "m02-borgo-salice");
  assert.equal(mapIllustrationForLocation("mir_marsh_approach"), "m02-mirto");
  assert.equal(mapIllustrationForLocation("undiscovered_hidden_cave"), null);
  assert.equal(mapIllustrationFormat("nonexistent"), null);
});
