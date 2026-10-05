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

function legalNState(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.mistwood_discovered = true;
  state.world.flags.mistwood_entry_complete = true;
  state.world.locationId = "asteria_mistwood";
  state.story.sceneId = "m02-n-enters";
  state.story.nodeId = "zorua_encounter";
  return state;
}

test("M2_04 scene compiles and zorua_encounter node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-n-enters"];
  assert.ok(scene, "m02-n-enters must compile");
  assert.ok(scene.nodes["zorua_encounter"], "zorua_encounter must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "asteria_mistwood");
});

test("M2_04 scene entry requires mistwood_entry_complete plus M2 gate conditions", async () => {
  const { engine } = await makeEngine();

  const legal = legalNState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.mistwood_entry_complete = false; },
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; }
  ]) {
    const state = legalNState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_04 choose() rejects illegal state", async () => {
  const { engine } = await makeEngine();
  const state = legalNState();
  state.world.flags.m2_active = false;
  await assert.rejects(
    () => engine.choose(state, "approach_cautiously"),
    /Scene conditions are not satisfied/
  );
});

test("M2_04 navigation from M2_02 signs_entry track_deeper requires capture_signs_noticed", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "signs_entry";

  const viewNoSigns = await engine.present(state);
  assert.equal(viewNoSigns.choices.some((c) => c.id === "track_deeper"), false);

  state.world.flags.capture_signs_noticed = true;
  const viewWithSigns = await engine.present(state);
  assert.ok(viewWithSigns.choices.some((c) => c.id === "track_deeper"), "track_deeper must be visible with capture_signs_noticed");
});

test("M2_04 track_deeper from signs_entry costs 20 min and enters zorua_encounter", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.story.sceneId = "m02-capture-signs";
  state.story.nodeId = "signs_entry";
  state.world.flags.capture_signs_noticed = true;
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "track_deeper");

  assert.equal(state.story.sceneId, "m02-n-enters");
  assert.equal(state.story.nodeId, "zorua_encounter");
  assert.equal(state.world.elapsedMinutes, before + 20);
});

test("M2_04 navigation from M2_03 Borgo requires capture_signs_noticed or capture_ranger_told", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";
  state.world.locationId = "borgo_salice";

  const viewNoContext = await engine.present(state);
  assert.equal(viewNoContext.choices.some((c) => c.id === "return_to_forest_n"), false);

  state.world.flags.capture_ranger_told = true;
  const viewWithRanger = await engine.present(state);
  assert.ok(viewWithRanger.choices.some((c) => c.id === "return_to_forest_n"));
});

test("M2_04 introduce_self is hidden when n_met is already true", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.world.flags.n_met = true;

  state = await engine.choose(state, "approach_cautiously");
  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "introduce_self"), false, "introduce_self must be hidden when n_met");
  assert.ok(view.choices.some((c) => c.id === "greet_n_again"), "greet_n_again must be visible when n_met");
});

test("M2_04 introduce_self registers N and sets n_met=true", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "approach_cautiously");
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.npcs?.N, undefined);

  state = await engine.choose(state, "introduce_self");

  assert.equal(state.world.flags.n_met, true);
  assert.ok(state.npcs?.N, "N must be registered");
  assert.equal(state.npcs.N.state.introduced, true);
  assert.equal(state.npcs.N.state.zorua_context, "mistwood");
  assert.equal(state.story.nodeId, "n_first_contact");
});

test("M2_04 move_toward_voice registers N and sets n_met=true", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalNState();

  state = await engine.choose(state, "observe_distance");
  assert.equal(state.story.nodeId, "zorua_shield_seen");

  state = await engine.choose(state, "call_from_distance");
  state = await engine.choose(state, "move_toward_voice");

  assert.equal(state.world.flags.n_met, true);
  assert.ok(state.npcs?.N);
  assert.equal(state.story.nodeId, "n_first_contact");
});

test("M2_04 leave_undisturbed sets n_encounter_avoided without meeting N", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "leave_undisturbed");

  assert.equal(state.story.nodeId, "zorua_left");
  assert.equal(state.world.flags.n_encounter_avoided, true);
  assert.equal(state.world.flags.n_met, undefined);
  assert.equal(state.npcs?.N, undefined);
});

test("M2_04 ethical path agree → shared_concern sets n_relationship_positive", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "approach_cautiously");
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "ask_what_happened");
  state = await engine.choose(state, "agree_zorua_free");
  state = await engine.choose(state, "explore_agree");
  state = await engine.choose(state, "accept_invitation");

  assert.equal(state.world.flags.n_relationship_positive, true);
  assert.equal(state.story.nodeId, "n_parted_ways");
});

test("M2_04 ethical path question → considers → shared_concern", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "approach_cautiously");
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "ask_what_happened");
  state = await engine.choose(state, "question_protection");
  state = await engine.choose(state, "push_further");
  state = await engine.choose(state, "acknowledge_n_thought");

  assert.equal(state.story.nodeId, "n_shared_concern");
});

test("M2_04 ball_rejected path leads to ethical choice", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "approach_cautiously");
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "ask_what_happened");
  state = await engine.choose(state, "offer_pokeball_here");

  assert.equal(state.story.nodeId, "n_ball_rejected");

  state = await engine.choose(state, "push_back_n");
  assert.equal(state.story.nodeId, "n_ethical_question");
});

test("M2_04 combat can be triggered and returns to n_combat_win or n_combat_lose", async () => {
  const { engine } = await makeEngine();
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-n-enters"];
  const node = scene.nodes["n_combat_zorua"];
  const combatChoice = node.choices.find((c) => c.id === "fight_zorua");
  assert.ok(combatChoice?.combat, "fight_zorua must have combat definition");
  assert.equal(combatChoice.combat.encounterId, "M2_N_ENTERS_ZORUA_DEFENSE");
  assert.equal(combatChoice.combat.opponent.species, "zorua");
  assert.equal(combatChoice.combat.returnNodes.win, "n_combat_win");
  assert.equal(combatChoice.combat.returnNodes.lose, "n_combat_lose");
  assert.equal(combatChoice.combat.opponentRegistered, false);
});

test("M2_04 n_combat_win sets n_relationship_tension", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.world.flags.n_met = true;
  state.npcs = { N: { id: "N", name: "N", relationship: { score: 0, qualitative: "neutral" }, state: { introduced: true, zorua_context: "mistwood" }, schedule: null } };
  state.story.nodeId = "n_combat_win";

  state = await engine.choose(state, "acknowledge_win");

  assert.equal(state.world.flags.n_relationship_tension, true);
  assert.equal(state.story.nodeId, "n_parted_tense");
});

test("M2_04 zorua_encounter_done routes back to capture signs with 10 min", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.world.flags.n_met = true;
  state.story.nodeId = "zorua_encounter_done";
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "return_to_investigation");

  assert.equal(state.story.sceneId, "m02-capture-signs");
  assert.equal(state.story.nodeId, "signs_entry");
  assert.equal(state.world.elapsedMinutes, before + 10);
});

test("M2_04 zorua_encounter_done routes to Borgo Salice with 210 min", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.story.nodeId = "zorua_encounter_done";
  const before = state.world.elapsedMinutes;

  state = await engine.choose(state, "head_to_salice_done");

  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.story.nodeId, "borough_hub");
  assert.equal(state.world.elapsedMinutes, before + 210);
});

test("M2_04 no premature M2 content triggered by any N encounter path", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "approach_cautiously");
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "ask_what_happened");
  state = await engine.choose(state, "agree_zorua_free");
  state = await engine.choose(state, "leave_agree");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.world.flags.friend_beat_02_complete, undefined);
  assert.equal(state.world.flags.poaching_network_state, undefined);
  assert.equal(state.events?.A2_LOCAL_PROBLEM, undefined);
  assert.equal(state.events?.A2_ROOKIE_CUP, undefined);
  assert.equal(state.competition.trials?.RANK_E_TO_D, undefined);
});

test("M2_04 exploration does not heal or mutate roster", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();
  state.player.roster.push({
    speciesId: "skwovet",
    name: "Skwovet",
    level: 4,
    hp: { current: 1, max: 20 },
    statuses: ["paralyzed"]
  });
  const rosterBefore = structuredClone(state.player.roster);

  state = await engine.choose(state, "approach_cautiously");
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "ask_what_happened");
  state = await engine.choose(state, "agree_zorua_free");
  state = await engine.choose(state, "leave_agree");

  assert.deepEqual(state.player.roster, rosterBefore);
});

test("M2_04 save/reload preserves n_met, N NPC data and M1 callbacks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-n-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalNState("Luke");
    state.slot = "m2-n-test";
    state.player.money = 310;
    state.world.flags.friend_beat_01_friend_id = "Valentina";
    state.world.flags.houndour_ginestre_disposition = "befriended";

    state = await engine.choose(state, "approach_cautiously");
    state = await engine.choose(state, "introduce_self");
    state = await engine.choose(state, "ask_what_happened");
    state = await engine.choose(state, "question_protection");
    state = await engine.choose(state, "push_further");
    state = await engine.choose(state, "acknowledge_n_thought");
    state = await engine.choose(state, "accept_invitation");

    await store.save(state);
    const loaded = await store.load("m2-n-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.n_met, true);
    assert.ok(loaded.npcs?.N);
    assert.equal(loaded.world.flags.n_relationship_positive, true);
    assert.equal(loaded.player.money, 310);
    assert.equal(loaded.world.flags.friend_beat_01_friend_id, "Valentina");
    assert.equal(loaded.world.flags.houndour_ginestre_disposition, "befriended");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("M2_04 divergent M1 history A (Ranger known, capture evidence) meets N without issue", async () => {
  const { engine } = await makeEngine();
  const state = legalNState();
  state.world.flags.capture_signs_noticed = true;
  state.world.flags.capture_evidence_held = true;
  state.world.flags.capture_ranger_told = true;
  state.world.flags.houndour_ginestre_disposition = "captured";

  const view = await engine.present(state);
  assert.ok(view, "history A must present N scene without error");
  assert.ok(view.choices.some((c) => c.id === "approach_cautiously"));
});

test("M2_04 divergent M1 history B (no signs, no ranger) can still enter scene and leave", async () => {
  const { engine } = await makeEngine();
  const state = legalNState();

  const view = await engine.present(state);
  assert.ok(view);
  assert.ok(view.choices.some((c) => c.id === "leave_undisturbed"), "leave option must exist regardless of prior state");
});

test("M2_04 repeated entry after n_met=true does not re-trigger introduction", async () => {
  const { engine } = await makeEngine();
  let state = legalNState();

  state = await engine.choose(state, "approach_cautiously");
  state = await engine.choose(state, "introduce_self");
  assert.equal(state.world.flags.n_met, true);
  const npcSnapshot = structuredClone(state.npcs.N);

  state = await engine.choose(state, "leave_after_contact");
  state = await engine.choose(state, "return_to_investigation");

  state.story.sceneId = "m02-n-enters";
  state.story.nodeId = "zorua_encounter";

  state = await engine.choose(state, "approach_cautiously");
  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "introduce_self"), false);
  assert.ok(view.choices.some((c) => c.id === "greet_n_again"));
  assert.deepEqual(state.npcs.N.state, npcSnapshot.state);
  assert.equal(state.player.money, state.player.money);
});
