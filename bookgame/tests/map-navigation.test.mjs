import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { buildTravelMap } from "../src/engine/map-view.mjs";
import { APPROVED_MAP_ILLUSTRATION_IDS, APPROVED_MAP_SVG_IDS, mapIllustrationForLocation, mapIllustrationFormat } from "../src/assets/map-illustrations.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

function ginestreState() {
  const state = createNewGameState({ protagonist: "Luke", slot: "slot1" });
  state.story.sceneId = "m01-ginestre-crossroads";
  state.story.nodeId = "crossroads";
  state.world.locationId = "asteria_ginestre";
  state.world.visitedLocationIds = ["asteria_campus_exit", "asteria_ginestre"];
  return state;
}

test("map shows only visited places and presently legal authored location choices", () => {
  const state = ginestreState();
  const story = {
    choices: [
      { id: "valedarsena", text: "Vado a Valedarsena", goto: "arrival",
        timeCostMinutes: 70, effects: [
          { type: "set_location", locationId: "valedarsena_road" },
          { type: "set_location", locationId: "valedarsena_city" }
        ] },
      { id: "secret", text: "Vado al luogo segreto", goto: "secret",
        conditions: { path: "world.flags.secret_access", eq: true },
        effects: [{ type: "set_location", locationId: "hidden_place" }] },
      { id: "danger", text: "Affronto il guardiano", goto: "fight",
        combat: {}, effects: [{ type: "set_location", locationId: "boss_arena" }] },
      { id: "investigate", text: "Controllo la strada", goto: "search",
        check: { ability: "wisdom", dc: 12 },
        effects: [{ type: "set_location", locationId: "unconfirmed_spot" }] },
      { id: "shortcut", text: "Un collegamento non canonico", goto: null,
        effects: [{ type: "set_location", locationId: "broken_link" }] }
    ]
  };
  const map = buildTravelMap(state, story);
  assert.equal(map.schematic, true);
  assert.equal(map.currentLocationId, "asteria_ginestre");
  assert.deepEqual(map.nodes.map((node) => node.id).sort(),
    ["asteria_campus_exit", "asteria_ginestre", "valedarsena_city"].sort());
  const city = map.nodes.find((node) => node.id === "valedarsena_city");
  assert.equal(city.visited, false);
  assert.deepEqual(city.routes, [
    { choiceId: "valedarsena", label: "Vado a Valedarsena", timeCostMinutes: 70 }
  ]);
  assert.equal(map.nodes.find((node) => node.id === "asteria_campus_exit").routes.length, 0);
  assert.equal(buildTravelMap({ ...state, pending: { type: "pokemon5e_combat" } }, story)
    .nodes.flatMap((node) => node.routes).length, 0);
  assert.equal(buildTravelMap(state, { ...story, trainerProgression: {} })
    .nodes.flatMap((node) => node.routes).length, 0);
});

test("M01 Ginestre → Valedarsena → Ginestre uses original choices, time and persistent discoveries", async () => {
  const engine = new BookgameEngine();
  const before = ginestreState();
  const first = await engine.present(before);
  const map = buildTravelMap(before, first);
  const city = map.nodes.find((node) => node.id === "valedarsena_city");
  assert.ok(city, "actual scene offers Valedarsena as a destination");
  assert.ok(city.routes.some((route) => route.choiceId === "to_valedarsena" && route.timeCostMinutes === 70));

  const moved = await engine.choose(before, "to_valedarsena");
  assert.equal(moved.world.locationId, "valedarsena_city");
  assert.equal(moved.world.elapsedMinutes - before.world.elapsedMinutes, 70);
  assert.ok(moved.world.visitedLocationIds.includes("valedarsena_road"));
  assert.ok(moved.world.visitedLocationIds.includes("valedarsena_city"));
  assert.equal(moved.story.sceneId, "m01-valedarsena-first-arrival");

  const arrival = await engine.present(moved);
  const returnRoute = buildTravelMap(moved, arrival).nodes
    .find((node) => node.id === "asteria_ginestre")?.routes;
  assert.ok(returnRoute?.some((route) => route.choiceId === "leave_city"));

  const back = await engine.choose(moved, "leave_city");
  assert.equal(back.world.locationId, "asteria_ginestre");
  assert.equal(back.world.elapsedMinutes - moved.world.elapsedMinutes, 70);
  assert.equal(back.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(back.story.nodeId, "crossroads");

  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-map-persistence-"));
  try {
    const store = new SaveStore(dir);
    await store.save(back);
    const reloaded = await store.load("slot1");
    assert.deepEqual(reloaded.world.visitedLocationIds, back.world.visitedLocationIds);
    assert.deepEqual(buildTravelMap(reloaded, await engine.present(reloaded)).nodes
      .filter((node) => node.visited).map((node) => node.id).sort(),
      back.world.visitedLocationIds.slice().sort());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mobile Map view is reachable, touch actionable and uses no bypass travel endpoint", async () => {
  const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");
  const [html, app, css, server] = await Promise.all([
    read("../ui/public/index.html"), read("../ui/public/app.mjs"),
    read("../ui/public/styles.css"), read("../ui/server.mjs")
  ]);
  assert.match(html, /data-panel="map"/);
  assert.match(app, /map: renderMap/);
  assert.match(app, /\.map-travel/);
  assert.match(app, /api\("\/api\/choose"/);
  assert.doesNotMatch(app, /\/api\/map\/teleport/);
  assert.match(css, /\.travel-map/);
  assert.match(css, /\.map-pin/);
  assert.match(server, /map: buildTravelMap\(state, story\)/);
});

test("M01 artwork is local, verified PNG and never replaces scene navigation", async () => {
  assert.deepEqual([...APPROVED_MAP_ILLUSTRATION_IDS].sort(),
    ["m01-ginestre", "m01-valedarsena"]);
  const samples = [
    ["asteria_ginestre", "m01-ginestre"],
    ["valedarsena_city", "m01-valedarsena"]
  ];
  for (const [id, asset] of samples) {
    assert.equal(mapIllustrationForLocation(id), asset);
    const png = await readFile(new URL(`../assets/maps/illustrations/${asset}.png`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(createHash("sha256").update(png).digest("hex"), {
      "m01-ginestre": "b0f6832c27f583260bf3c7132ef7fc4df1a8606b1a9cedc0cb0bc5f50313bfe3",
      "m01-valedarsena": "70d1197c2333a465dc693b67fa11b0b2035368d281c8b54f38d69202d863dcb6"
    }[asset]);
    assert.equal(png.readUInt32BE(16), 320);
    assert.equal(png.readUInt32BE(20), 192);
  }
  assert.equal(mapIllustrationForLocation("hidden_place"), null);
  const world = ginestreState();
  const visible = buildTravelMap(world, { choices: [] });
  assert.equal(visible.nodes.find((item) => item.id === "asteria_ginestre")?.illustrationId, "m01-ginestre");
  assert.equal(visible.nodes.some((item) => item.id === "hidden_place"), false);

  const [ui, server] = await Promise.all([
    readFile(new URL("../ui/public/app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../ui/server.mjs", import.meta.url), "utf8")
  ]);
  assert.match(ui, /map-site__art/);
  assert.match(server, /APPROVED_MAP_ILLUSTRATION_IDS/);
  assert.match(server, /serveMapIllustration/);
  assert.ok(server.includes('"/map-art/"'));
});

test("M01 location art covers every authored scene origin and set_location effect", async () => {
  const directory = new URL("../content/scenes/", import.meta.url);
  const entries = (await readdir(directory)).filter((name) => name.startsWith("m01-") && name.endsWith(".json"));
  assert.ok(entries.length >= 10);
  const locationIds = new Set();
  const collect = (node) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== "object") return;
    if (node.type === "set_location") locationIds.add(node.locationId);
    for (const value of Object.values(node)) if (value && typeof value === "object") collect(value);
  };
  for (const entry of entries) {
    const data = JSON.parse(await readFile(new URL(entry, directory), "utf8"));
    if (data.locationId) locationIds.add(data.locationId);
    collect(data.nodes);
  }
  assert.ok(locationIds.size >= 16, "M01 map audit cannot silently shrink");
  for (const locationId of locationIds) {
    assert.equal(typeof locationId, "string");
    const illustrationId = mapIllustrationForLocation(locationId);
    const ext = mapIllustrationFormat(illustrationId);
    assert.ok(illustrationId && ext, `Unmapped authored M01 location: ${locationId}`);
    const bytes = await readFile(new URL(`../assets/maps/illustrations/${illustrationId}.${ext}`, import.meta.url));
    if (ext === "svg") {
      const svg = bytes.toString("utf8");
      assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
      assert.ok(svg.trimEnd().endsWith("</svg>"));
      assert.doesNotMatch(svg, /<script|<foreignObject|onload=|javascript:/i);
    } else {
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    }
  }
  assert.equal(APPROVED_MAP_SVG_IDS.size, 13);
  assert.equal(mapIllustrationForLocation("unwritten_new_town"), null);
  assert.equal(mapIllustrationFormat("unapproved"), null);

  const state = ginestreState();
  const story = { choices: [
    { id: "test_travel", goto: "crossroads", text: "Raggiungi fattoria",
      effects: [{ type: "set_location", locationId: "asteria_farm" }], timeCostMinutes: 55 }
  ] };
  const map = buildTravelMap(state, story);
  const farm = map.nodes.find((node) => node.id === "asteria_farm");
  assert.equal(farm.illustrationId, "m01-farm");
  assert.equal(farm.illustrationFormat, "svg");
  assert.equal(farm.routes[0].timeCostMinutes, 55);
  assert.equal(map.nodes.some((node) => node.id === "unwritten_new_town"), false);

  const [server, app] = await Promise.all([
    readFile(new URL("../ui/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../ui/public/app.mjs", import.meta.url), "utf8")
  ]);
  assert.match(server, /APPROVED_MAP_SVG_IDS/);
  assert.ok(server.includes("image/svg+xml"));
  assert.match(app, /illustrationFormat/);
});
