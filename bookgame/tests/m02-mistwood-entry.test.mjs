import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const ecologyProfilesDir = fileURLToPath(new URL("../content/ecology/", import.meta.url));
const zonePoolsFile = fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json", import.meta.url));
const distributionFile = fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json", import.meta.url));
const faunaIndexFile = fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json", import.meta.url));
const ecologyOptions = { profilesDir: ecologyProfilesDir, zonePoolsFile, distributionFile, faunaIndexFile };
const fixedNow = () => "2026-10-05T11:30:00.000Z";

async function makeEngine(dice = new SequenceDice([1])) {
  const bundle = await compileStory({ scenesDir, modulesDir, ecologyOptions });
  const scenes = {
    async load(sceneId) {
      const scene = bundle.scenes[sceneId];
      if (!scene) throw new Error("missing scene " + sceneId);
      return structuredClone(scene);
    },
    async loadWorldEvents() {
      return structuredClone(bundle.worldEvents ?? []);
    },
    async loadEcology() {
      return structuredClone(bundle.ecology);
    }
  };
  return { engine: new BookgameEngine({ scenes, dice, now: fixedNow }), bundle };
}

function legalM2State(protagonist = "Luke") {
  const state = createNewGameState({ protagonist, now: fixedNow });
  state.competition.rank = "E";
  state.competition.rankOrder = 1;
  state.world.flags.m1_complete = true;
  state.world.flags.m02_unlocked = true;
  state.world.flags.m2_active = true;
  state.world.flags.blue_met = true;
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friends_split = true;
  state.world.locationId = "valedarsena_city";
  state.story.sceneId = "m01-valedarsena-first-arrival";
  state.story.nodeId = "city_hub";
  return state;
}

test("M2_01 ecology catalog compiles AST-MISTWOOD from the authoritative zone", async () => {
  const { bundle } = await makeEngine();
  const zone = bundle.ecology.zones["AST-MISTWOOD"];
  assert.ok(zone);
  assert.equal(zone.sourceZoneId, "AST-MISTWOOD");
  assert.equal(zone.moduleId, "M02");
  assert.ok(zone.habitats.includes("forest"));
  assert.ok(zone.methods.includes("wild_observation"));
  for (const id of ["caterpie", "combee", "shroomish", "skwovet"]) {
    assert.equal(zone.species.some((entry) => entry.id === id), true, id + " must be valid in compiled Mistwood ecology");
  }
});

test("M2_01 Valedarsena hub exposes Bosco Bruma only after M2 activation", async () => {
  const { engine } = await makeEngine();
  const legal = legalM2State();
  const openView = await engine.present(legal);
  assert.equal(openView.choices.some((c) => c.id === "mistwood"), true);

  const inactive = legalM2State();
  inactive.world.flags.m2_active = false;
  const closedView = await engine.present(inactive);
  assert.equal(closedView.choices.some((c) => c.id === "mistwood"), false);
});

test("M2_01 travel from Valedarsena costs the canonical 150 minutes and reaches Mistwood", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "mistwood");

  assert.equal(state.story.sceneId, "m02-mistwood-entry");
  assert.equal(state.story.nodeId, "departure");
  assert.equal(state.world.locationId, "asteria_mistwood");
  assert.equal(state.world.elapsedMinutes, before + 150);
});

test("M2_01 scene requires m2_active at both present() and choose()", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.story.sceneId = "m02-mistwood-entry";
  state.story.nodeId = "departure";
  state.world.flags.m2_active = false;

  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
  await assert.rejects(() => engine.choose(state, "enter_wood"), /Scene conditions are not satisfied/);
});

test("M2_01 scene also rejects missing M1 completion, unlock, or Rank E", async () => {
  const { engine } = await makeEngine();

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; }
  ]) {
    const state = legalM2State();
    state.story.sceneId = "m02-mistwood-entry";
    state.story.nodeId = "departure";
    mutate(state);
    await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
  }
});

test("M2_01 entering the wood records discovery without changing rank or starting later beats", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");

  assert.equal(state.story.nodeId, "threshold");
  assert.equal(state.world.flags.mistwood_discovered, true);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.events.A2_LOCAL_PROBLEM, undefined);
  assert.equal(state.events.A2_ROOKIE_CUP, undefined);
  assert.equal(state.competition.trials.RANK_E_TO_D, undefined);
});

test("M2_01 wildlife observation uses E7 and records a contextual AST-MISTWOOD encounter", async () => {
  const { engine } = await makeEngine(new SequenceDice([1]));
  let state = legalM2State();
  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "observe_forest");

  assert.equal(state.world.elapsedMinutes, before + 20);
  assert.equal(state.ecology.history.length, 1);
  assert.equal(state.ecology.lastEncounter.zoneId, "AST-MISTWOOD");
  assert.equal(["caterpie", "combee", "shroomish", "skwovet"].includes(state.ecology.lastEncounter.speciesId), true);
  assert.equal(state.world.locationId, "asteria_mistwood");
});

test("M2_01 press_deeper advances time and sets the durable entry completion flag", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "press_deeper");

  assert.equal(state.story.nodeId, "inner_path");
  assert.equal(state.world.elapsedMinutes, before + 25);
  assert.equal(state.world.flags.mistwood_entry_complete, true);
  assert.equal(state.world.flags.mistwood_discovered, true);
});

test("M2_01 can return to Valedarsena with real return travel time", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state = await engine.choose(state, "mistwood");
  const beforeReturn = state.world.elapsedMinutes;

  state = await engine.choose(state, "return_valedarsena");

  assert.equal(state.story.sceneId, "m01-valedarsena-first-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "valedarsena_city");
  assert.equal(state.world.elapsedMinutes, beforeReturn + 150);
});

test("M2_01 repeated entry is idempotent for discovery and preserves persistent M1 state", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.player.money = 615;
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 4 });

  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  state = await engine.choose(state, "back_to_city");
  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");

  assert.equal(state.world.flags.mistwood_discovered, true);
  assert.equal(state.player.money, 615);
  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(state.player.roster.length, 2);
  assert.equal(state.competition.rank, "E");
});

test("M2_01 save/reload preserves Mistwood discovery, time, location and M1 callbacks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-mistwood-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalM2State("Luke");
    state.slot = "m2-mistwood-test";
    state.player.money = 480;
    state.world.flags.friend_beat_01_friend_id = "Daniel";
    state.world.flags.houndour_ginestre_disposition = "calmed";

    state = await engine.choose(state, "mistwood");
    state = await engine.choose(state, "enter_wood");
    state = await engine.choose(state, "press_deeper");

    await store.save(state);
    const loaded = await store.load("m2-mistwood-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.mistwood_discovered, true);
    assert.equal(loaded.world.flags.mistwood_entry_complete, true);
    assert.equal(loaded.world.locationId, "asteria_mistwood");
    assert.equal(loaded.player.money, 480);
    assert.equal(loaded.world.flags.friend_beat_01_friend_id, "Daniel");
    assert.equal(loaded.world.flags.houndour_ginestre_disposition, "calmed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M2_01 authoring does not heal or mutate a battle-worn roster", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 5,
    hp: { current: 3, max: 22 },
    statuses: ["poisoned"]
  });
  const before = structuredClone(state.player.roster);

  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  state = await engine.choose(state, "press_deeper");

  assert.deepEqual(state.player.roster, before);
});
