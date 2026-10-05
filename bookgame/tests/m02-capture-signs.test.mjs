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

function legalM2_02State(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.mistwood_discovered = true;
  state.world.flags.mistwood_entry_complete = true;
  state.world.locationId = "asteria_mistwood";
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "signs_entry";
  return state;
}

test("M2_02 scene compiles and signs_entry node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-capture-signs"];
  assert.ok(scene, "m02-capture-signs scene must compile");
  assert.ok(scene.nodes["signs_entry"], "signs_entry node must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "asteria_mistwood");
});

test("M2_02 scene entry requires mistwood_entry_complete plus M2 gate conditions", async () => {
  const { engine } = await makeEngine();

  const legal = legalM2_02State();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.mistwood_entry_complete = false; },
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; }
  ]) {
    const state = legalM2_02State();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_02 choose() also rejects illegal state", async () => {
  const { engine } = await makeEngine();
  const state = legalM2_02State();
  state.world.flags.mistwood_entry_complete = false;
  await assert.rejects(
    () => engine.choose(state, "return_threshold"),
    /Scene conditions are not satisfied/
  );
});

test("M2_02 navigation from M2_01 inner_path is available after mistwood_entry_complete", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();

  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  state = await engine.choose(state, "press_deeper");

  assert.equal(state.story.nodeId, "inner_path");
  assert.equal(state.world.flags.mistwood_entry_complete, true);

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "explore_inner"), "explore_inner must be visible in inner_path");
});

test("M2_02 explore_inner choice costs 15 minutes and enters signs_entry", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state = await engine.choose(state, "mistwood");
  state = await engine.choose(state, "enter_wood");
  state = await engine.choose(state, "press_deeper");
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "explore_inner");

  assert.equal(state.story.sceneId, "m02-capture-signs");
  assert.equal(state.story.nodeId, "signs_entry");
  assert.equal(state.world.elapsedMinutes, before + 15);
});

test("M2_02 successful ground investigation sets capture_ground_signs and routes to ground_clear", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");

  assert.equal(state.story.nodeId, "ground_clear");
  assert.equal(state.world.flags.capture_ground_signs, true);
  assert.equal(state.world.flags.capture_signs_noticed, undefined);
});

test("M2_02 failed ground investigation routes to ground_ambiguous without setting flags", async () => {
  const { engine } = await makeEngine(new SequenceDice([1]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");

  assert.equal(state.story.nodeId, "ground_ambiguous");
  assert.equal(state.world.flags.capture_ground_signs, undefined);
});

test("M2_02 full investigation path reaches cache_site and sets capture_signs_investigated", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");
  assert.equal(state.story.nodeId, "ground_clear");

  state = await engine.choose(state, "follow_drag");
  assert.equal(state.story.nodeId, "drag_trail");

  state = await engine.choose(state, "investigate_endpoint");
  assert.equal(state.story.nodeId, "cache_site");
  assert.equal(state.world.flags.capture_signs_investigated, true);
});

test("M2_02 documenting cache sets capture_evidence_held", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");
  state = await engine.choose(state, "follow_drag");
  state = await engine.choose(state, "investigate_endpoint");
  state = await engine.choose(state, "document_site");

  assert.equal(state.story.nodeId, "cache_documented");
  assert.equal(state.world.flags.capture_evidence_held, true);
  assert.equal(state.world.flags.capture_signs_investigated, true);
});

test("M2_02 leaving cache intact sets capture_site_located without capture_evidence_held", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");
  state = await engine.choose(state, "follow_drag");
  state = await engine.choose(state, "investigate_endpoint");
  state = await engine.choose(state, "leave_intact");

  assert.equal(state.world.flags.capture_site_located, true);
  assert.equal(state.world.flags.capture_evidence_held, undefined);
});

test("M2_02 flagging for ranger sets capture_ranger_note", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");
  state = await engine.choose(state, "follow_drag");
  state = await engine.choose(state, "investigate_endpoint");
  state = await engine.choose(state, "flag_ranger");

  assert.equal(state.world.flags.capture_ranger_note, true);
});

test("M2_02 successful watch_zone sets capture_aerial_signs and capture_signs_noticed", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "watch_zone");

  assert.equal(state.story.nodeId, "zone_pattern");
  assert.equal(state.world.flags.capture_aerial_signs, true);
  assert.equal(state.world.flags.capture_signs_noticed, true);
});

test("M2_02 correlate_with_ground is only visible when capture_ground_signs is true", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "watch_zone");
  assert.equal(state.story.nodeId, "zone_pattern");

  const viewWithoutGround = await engine.present(state);
  assert.equal(viewWithoutGround.choices.some((c) => c.id === "correlate_with_ground"), false);

  state.world.flags.capture_ground_signs = true;
  const viewWithGround = await engine.present(state);
  assert.equal(viewWithGround.choices.some((c) => c.id === "correlate_with_ground"), true);
});

test("M2_02 correlate_with_ground sets capture_signs_investigated", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20]));
  let state = legalM2_02State();
  state.world.flags.capture_ground_signs = true;

  state = await engine.choose(state, "watch_zone");
  state = await engine.choose(state, "correlate_with_ground");

  assert.equal(state.story.nodeId, "dual_read");
  assert.equal(state.world.flags.capture_signs_investigated, true);
});

test("M2_02 hollow path reaches hollow_used on success and sets capture_signs_noticed", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "northeast_hollow");
  assert.equal(state.story.nodeId, "hollow_approach");

  state = await engine.choose(state, "investigate_hollow");
  assert.equal(state.story.nodeId, "hollow_used");
  assert.equal(state.world.flags.capture_signs_noticed, true);
});

test("M2_02 collecting remnant sets capture_evidence_held", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "northeast_hollow");
  state = await engine.choose(state, "investigate_hollow");
  state = await engine.choose(state, "collect_remnant");

  assert.equal(state.story.nodeId, "remnant_examined");
  assert.equal(state.world.flags.capture_evidence_held, true);
});

test("M2_02 move_through sets mistwood_inner_traversed and reaches inner_exit", async () => {
  const { engine } = await makeEngine();
  let state = legalM2_02State();
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "move_through");

  assert.equal(state.story.nodeId, "inner_exit");
  assert.equal(state.world.flags.mistwood_inner_traversed, true);
  assert.equal(state.world.elapsedMinutes, before + 30);
});

test("M2_02 return_threshold exits back to m02-mistwood-entry#threshold", async () => {
  const { engine } = await makeEngine();
  let state = legalM2_02State();

  state = await engine.choose(state, "return_threshold");

  assert.equal(state.story.sceneId, "m02-mistwood-entry");
  assert.equal(state.story.nodeId, "threshold");
});

test("M2_02 no premature M2 content is triggered by any investigation path", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();

  state = await engine.choose(state, "examine_ground");
  state = await engine.choose(state, "follow_drag");
  state = await engine.choose(state, "investigate_endpoint");
  state = await engine.choose(state, "document_site");
  state = await engine.choose(state, "back_from_cache_doc");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.events?.A2_LOCAL_PROBLEM, undefined);
  assert.equal(state.events?.A2_ROOKIE_CUP, undefined);
  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});

test("M2_02 exploration does not heal or mutate roster", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();
  state.player.roster.push({
    speciesId: "shinx",
    name: "Shinx",
    level: 5,
    hp: { current: 3, max: 22 },
    statuses: ["poisoned"]
  });
  const rosterBefore = structuredClone(state.player.roster);

  state = await engine.choose(state, "examine_ground");
  state = await engine.choose(state, "follow_drag");
  state = await engine.choose(state, "investigate_endpoint");

  assert.deepEqual(state.player.roster, rosterBefore);
});

test("M2_02 save/reload preserves investigation flags and M1 callbacks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-capture-"));
  try {
    const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
    const store = new SaveStore(dir);
    let state = legalM2_02State("Luke");
    state.slot = "m2-capture-test";
    state.player.money = 390;
    state.world.flags.friend_beat_01_friend_id = "Sara";
    state.world.flags.houndour_ginestre_disposition = "befriended";

    state = await engine.choose(state, "examine_ground");
    state = await engine.choose(state, "follow_drag");
    state = await engine.choose(state, "investigate_endpoint");
    state = await engine.choose(state, "flag_ranger");

    await store.save(state);
    const loaded = await store.load("m2-capture-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.capture_signs_investigated, true);
    assert.equal(loaded.world.flags.capture_ranger_note, true);
    assert.equal(loaded.player.money, 390);
    assert.equal(loaded.world.flags.friend_beat_01_friend_id, "Sara");
    assert.equal(loaded.world.flags.houndour_ginestre_disposition, "befriended");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M2_02 divergent M1 history A (Houndour captured, Blue fought, won trial) can access scene", async () => {
  const { engine } = await makeEngine();
  const state = legalM2_02State();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.blue_challenge_accepted = true;
  state.world.flags.first_official_result = "won";
  state.world.flags.trial_attempt_count = 2;
  state.player.roster.push({ speciesId: "houndour", name: "Houndour", level: 4 });
  state.player.money = 620;

  const view = await engine.present(state);
  assert.ok(view, "history A must present M2_02 without error");
  assert.ok(view.choices.some((c) => c.id === "examine_ground"));
});

test("M2_02 divergent M1 history B (Houndour gone, Blue avoided, lost trial) can access scene", async () => {
  const { engine } = await makeEngine();
  const state = legalM2_02State();
  state.world.flags.houndour_ginestre_disposition = "fled";
  state.world.flags.blue_challenge_accepted = false;
  state.world.flags.first_official_result = "lost";
  state.world.flags.trial_attempt_count = 1;
  state.player.money = 200;

  const view = await engine.present(state);
  assert.ok(view, "history B must present M2_02 without error");
  assert.ok(view.choices.some((c) => c.id === "examine_ground"));
});

test("M2_02 repeated entry is idempotent — existing investigation flags are preserved", async () => {
  const { engine } = await makeEngine(new SequenceDice([20, 20, 20]));
  let state = legalM2_02State();
  state.player.money = 500;

  state = await engine.choose(state, "examine_ground");
  state = await engine.choose(state, "follow_drag");
  state = await engine.choose(state, "investigate_endpoint");
  state = await engine.choose(state, "leave_intact");

  assert.equal(state.world.flags.capture_site_located, true);
  assert.equal(state.world.flags.capture_signs_investigated, true);

  state = await engine.choose(state, "return_threshold");
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "signs_entry";

  const view = await engine.present(state);
  assert.ok(view, "re-entry must succeed");
  assert.equal(state.world.flags.capture_site_located, true);
  assert.equal(state.world.flags.capture_signs_investigated, true);
  assert.equal(state.player.money, 500);
});
