import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

import {
  mapIllustrationForLocation, mapIllustrationFormat,
  APPROVED_MAP_SVG_IDS, APPROVED_MAP_ILLUSTRATION_IDS
} from "../src/assets/map-illustrations.mjs";
import { locationLabel } from "../src/engine/map-view.mjs";

const MODULE_LOCATION_MINIMUMS = {
  m05: 11, m06: 13, m07: 6, m08: 10,
  m09: 2, m10: 1, m11: 1, m12: 8
};

test("M05–M12: every playable authored location has physically bundled approved offline art", async () => {
  const base = new URL("../content/scenes/", import.meta.url);
  const names = await readdir(base);
  const seen = new Map();
  function inspect(value, ids) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach((v) => inspect(v, ids));
    if (value.type === "set_location") ids.add(value.locationId);
    for (const nested of Object.values(value)) if (nested && typeof nested === "object") inspect(nested, ids);
  }
  for (const [moduleId, minimum] of Object.entries(MODULE_LOCATION_MINIMUMS)) {
    const files = names.filter((name) => name.startsWith(moduleId + "-") && name.endsWith(".json"));
    assert.ok(files.length >= 9, `Expected playable scene JSONs for ${moduleId}`);
    const ids = new Set();
    for (const filename of files) {
      const scene = JSON.parse(await readFile(new URL(filename, base), "utf8"));
      if (scene.locationId) ids.add(scene.locationId);
      inspect(scene.nodes, ids);
    }
    assert.ok(ids.size >= minimum, `${moduleId}: scene inventory unexpectedly shrank`);
    for (const locationId of ids) {
      const artId = mapIllustrationForLocation(locationId);
      const ext = mapIllustrationFormat(artId);
      assert.ok(artId && ext, `${moduleId}: missing approved offline map for ${locationId}`);
      const file = await readFile(new URL(`../assets/maps/illustrations/${artId}.${ext}`, import.meta.url));
      if (ext === "png") {
        assert.equal(file.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.ok(APPROVED_MAP_ILLUSTRATION_IDS.has(artId));
      } else {
        const svg = file.toString("utf8");
        assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
        assert.ok(svg.trimEnd().endsWith("</svg>"));
        assert.ok(!/<script|<foreignObject|onload=|javascript:/i.test(svg));
        assert.ok(APPROVED_MAP_SVG_IDS.has(artId));
      }
    }
    seen.set(moduleId, ids);
  }
  assert.equal(mapIllustrationForLocation("meridiana_city"), "m07-meridiana");
  assert.equal(mapIllustrationForLocation("world_village"), "m08-world-village");
  assert.equal(mapIllustrationForLocation("world_group_arena"), "m07-world-arena");
  assert.equal(mapIllustrationForLocation("world_knockout_hall"), "m07-grand-hall");
  // The world after the championship reuses earlier locations, never M12-only art.
  for (const locationId of seen.get("m12")) {
    const artId = mapIllustrationForLocation(locationId);
    assert.ok(artId && !artId.startsWith("m12-"));
  }
  assert.equal(mapIllustrationForLocation("invented_parallel_region"), null);
  assert.equal(mapIllustrationFormat("untrusted-asset"), null);
});

test("all playable scene files including intro and legendary hunt have safe real offline art", async () => {
  const root = new URL("../content/scenes/", import.meta.url);
  const files = (await readdir(root)).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 156, "Full canon scene inventory unexpectedly shrank");
  const ids = new Set();
  function collect(v) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(collect);
    if (v.type === "set_location") ids.add(v.locationId);
    for (const next of Object.values(v)) if (next && typeof next === "object") collect(next);
  }
  for (const filename of files) {
    const data = JSON.parse(await readFile(new URL(filename, root), "utf8"));
    if (data.locationId) ids.add(data.locationId);
    collect(data.nodes);
  }
  assert.ok(ids.size >= 91, "Canonical location inventory must not shrink silently");
  for (const id of ids) {
    const artId = mapIllustrationForLocation(id);
    const ext = mapIllustrationFormat(artId);
    assert.ok(artId && ext, `No offline image for authored scene location ${id}`);
    assert.notEqual(locationLabel(id), id.replaceAll("_", " "), `No friendly Italian label for ${id}`);
    assert.ok((ext === "svg" && APPROVED_MAP_SVG_IDS.has(artId)) ||
      (ext === "png" && APPROVED_MAP_ILLUSTRATION_IDS.has(artId)));
    assert.ok(!artId.includes("..") && !artId.includes("/"));
    const image = await readFile(new URL(`../assets/maps/illustrations/${artId}.${ext}`, import.meta.url));
    if (ext === "png") assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    else assert.ok(image.toString("utf8").includes("<svg"));
  }
  assert.equal(mapIllustrationForLocation("meridiana_city"), "m07-meridiana");
  assert.equal(mapIllustrationForLocation("asteria_campus"), "m01-campus");
});
