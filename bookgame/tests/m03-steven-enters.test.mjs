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
const fixedNow = () => "2026-10-05T15:00:00.000Z";

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

function legalM3State(protagonist = "Luke") {
  const state = createNewGameState({ protagonist, now: fixedNow });
  state.competition.rank = "D";
  state.competition.rankOrder = 2;
  state.world.flags.m1_complete = true;
  state.world.flags.m02_unlocked = true;
  state.world.flags.m2_active = true;
  state.world.flags.m2_complete = true;
  state.world.flags.m03_unlocked = true;
  state.world.flags.m3_active = true;
  state.world.flags.ferravia_discovered = true;
  state.world.flags.blue_met = true;
  state.npcs.Blue.state.met = true;
  state.world.flags.friend_beat_01_complete = true;
  state.world.flags.friend_beat_01_friend_id = "Mattew";
  state.world.flags.friends_split = true;
  state.world.flags.n_met = true;
  state.world.flags.friend_beat_02_complete = true;
  state.world.flags.friend_beat_02_friend_id = "Daniel";
  state.world.flags.network_outcome_complete = true;
  state.world.flags.poaching_network_state = "resolved";
  return state;
}

// State satisfying Steven's entry contract (old_maps_read OR ferrox_survey_report_read)
function legalM3StevenGate(protagonist = "Luke") {
  const state = legalM3State(protagonist);
  state.world.flags.old_maps_read = true;
  state.world.flags.tunnels_history_mentioned = true;
  return state;
}

function enterSteven(state) {
  state.story.sceneId = "m03-steven-enters";
  state.story.nodeId = "steven_appears";
  state.world.locationId = "fer_city_archive";
  return state;
}

// ─── COMPILATION / NODE PRESENCE ──────────────────────────────────────────────

test("M3_04 scene compiles and all key nodes exist", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m03-steven-enters"];
  assert.ok(scene, "m03-steven-enters must compile");
  assert.equal(scene.moduleId, "M03");
  assert.equal(scene.entryNodeId, "steven_appears");
  for (const nodeId of [
    "steven_appears",
    "introduction_exchange",
    "steven_notes_old_maps",
    "steven_notes_survey",
    "steven_notes_generic",
    "silent_observation",
    "silent_outside",
    "post_steven_hub"
  ]) {
    assert.ok(scene.nodes[nodeId], `node ${nodeId} must exist`);
  }
});

// ─── LEGAL ENTRY (REQUIRES old_maps_read OR ferrox_survey_report_read) ────────

test("M3_04 legal entry via old_maps_read presents steven_appears", async () => {
  const { engine } = await makeEngine();
  const state = enterSteven(legalM3StevenGate());
  const view = await engine.present(state);
  assert.equal(view.sceneId, "m03-steven-enters");
  assert.equal(view.nodeId, "steven_appears");
  assert.ok(view.choices.find((c) => c.id === "introduce_self"));
  assert.ok(view.choices.find((c) => c.id === "wait_and_listen"));
  assert.ok(view.choices.find((c) => c.id === "leave_without_meeting"));
});

test("M3_04 legal entry via ferrox_survey_report_read presents steven_appears", async () => {
  const { engine } = await makeEngine();
  const state = legalM3State();
  state.world.flags.ferrox_survey_report_read = true;
  enterSteven(state);
  const view = await engine.present(state);
  assert.equal(view.nodeId, "steven_appears");
});

// ─── ILLEGAL ENTRY ────────────────────────────────────────────────────────────

test("M3_04 illegal entry: neither old_maps_read nor survey_report_read blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterSteven(legalM3State());
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_04 illegal entry: rank E blocks present() even with old_maps_read", async () => {
  const { engine } = await makeEngine();
  const state = enterSteven(legalM3StevenGate());
  state.competition.rank = "E";
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

test("M3_04 illegal entry: m3_active=false blocks present()", async () => {
  const { engine } = await makeEngine();
  const state = enterSteven(legalM3StevenGate());
  state.world.flags.m3_active = false;
  await assert.rejects(() => engine.present(state), /Scene conditions are not satisfied/);
});

// ─── INTRODUCTION PATH REGISTERS STEVEN ───────────────────────────────────────

test("M3_04 introduce_self registers Steven NPC and sets steven_met", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "introduce_self");
  assert.equal(state.story.nodeId, "introduction_exchange");
  assert.equal(state.world.flags.steven_met, true);
  assert.ok(state.npcs.Steven, "Steven must be registered as a persistent NPC");
  assert.equal(state.npcs.Steven.state.introduced, true);
  assert.equal(state.npcs.Steven.state.role, "technical_observer");
  assert.equal(state.npcs.Steven.state.context, "ferravia_archive");
});

test("M3_04 answer_old_maps uses the correct conditional and raises respects_player_insight", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "introduce_self");

  const view = await engine.present(state);
  // answer_old_maps requires old_maps_read=true (which is set)
  assert.ok(view.choices.find((c) => c.id === "answer_old_maps"), "answer_old_maps must be visible when old_maps_read=true");

  state = await engine.choose(state, "answer_old_maps");
  assert.equal(state.story.nodeId, "steven_notes_old_maps");
  state = await engine.choose(state, "steven_notes_back_old");
  assert.equal(state.npcs.Steven.state.respects_player_insight, true);
  assert.equal(state.npcs.Steven.relationship.score, 10);
});

test("M3_04 answer_report requires ferrox_survey_report_read", async () => {
  const { engine } = await makeEngine();
  // only survey read, not old maps
  let state = legalM3State();
  state.world.flags.ferrox_survey_report_read = true;
  enterSteven(state);
  state = await engine.choose(state, "introduce_self");

  const view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "answer_report"), "answer_report must be visible");
  assert.equal(view.choices.find((c) => c.id === "answer_old_maps"), undefined, "answer_old_maps must be hidden when old_maps_read is false");

  state = await engine.choose(state, "answer_report");
  assert.equal(state.story.nodeId, "steven_notes_survey");
  state = await engine.choose(state, "steven_notes_back_survey");
  assert.equal(state.npcs.Steven.state.respects_player_insight, true);
  assert.equal(state.npcs.Steven.relationship.score, 8);
});

test("M3_04 answer_generic path is always available and sets neutral_contact", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "answer_generic");
  assert.equal(state.story.nodeId, "steven_notes_generic");
  state = await engine.choose(state, "steven_notes_back_generic");
  assert.equal(state.npcs.Steven.state.neutral_contact, true);
  assert.equal(state.npcs.Steven.relationship.score, 0, "generic answer gives no relationship bump");
});

// ─── SILENT OBSERVATION PATH DOES NOT REGISTER STEVEN ─────────────────────────

test("M3_04 wait_and_listen + silent_stay_in_archive does NOT register Steven", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "wait_and_listen");
  assert.equal(state.story.nodeId, "silent_observation");
  state = await engine.choose(state, "silent_stay_in_archive");
  assert.equal(state.world.flags.steven_observed_silently, true);
  assert.equal(state.world.flags.steven_met, undefined);
  assert.equal(state.npcs.Steven, undefined, "Steven must not be registered without introduction");
});

test("M3_04 silent_outside + catch_up_and_introduce registers Steven with street context", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "wait_and_listen");
  state = await engine.choose(state, "silent_follow_outside");
  state = await engine.choose(state, "catch_up_and_introduce");
  assert.equal(state.story.nodeId, "introduction_exchange");
  assert.equal(state.world.flags.steven_met, true);
  assert.ok(state.npcs.Steven);
  assert.equal(state.npcs.Steven.state.context, "ferravia_street");
});

test("M3_04 silent_outside + let_him_go sets both silent and declined flags", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "wait_and_listen");
  state = await engine.choose(state, "silent_follow_outside");
  state = await engine.choose(state, "let_him_go");
  assert.equal(state.world.flags.steven_observed_silently, true);
  assert.equal(state.world.flags.steven_declined_contact, true);
  assert.equal(state.world.flags.steven_met, undefined);
  assert.equal(state.npcs.Steven, undefined);
});

// ─── LEAVE WITHOUT MEETING ────────────────────────────────────────────────────

test("M3_04 leave_without_meeting sets steven_declined_contact and routes to Ferravia hub", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "leave_without_meeting");
  assert.equal(state.story.sceneId, "m03-ferravia-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.flags.steven_declined_contact, true);
  assert.equal(state.world.flags.steven_met, undefined);
});

// ─── NO PREMATURE M3 CONTENT ──────────────────────────────────────────────────

test("M3_04 meeting Steven does NOT trigger Ferrox incident, FRIEND_BEAT_03, Regional Cup or D→C trial", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "answer_old_maps");
  state = await engine.choose(state, "steven_notes_back_old");

  assert.equal(state.world.flags.steven_met, true, "steven_met IS set — expected by M3 exit contract");
  assert.equal(state.world.flags.friend_beat_03_complete, undefined);
  assert.equal(state.world.flags.ferrox_incident_started, undefined);
  assert.equal(state.world.flags.ferrox_rescue_state, undefined);
  assert.equal(state.world.flags.regional_cup_registered, undefined);
  assert.equal(state.world.flags.m3_complete, undefined);
  assert.equal(state.competition.rank, "D");
  assert.equal(state.competition.trials.RANK_D_TO_C, undefined);
  assert.equal(state.events.A3_FRIEND_CALL, undefined);
  assert.equal(state.events.A3_CROSSROADS, undefined);
  assert.equal(state.events.A3_REGIONAL_CUP, undefined);
  assert.equal(state.events.A3_RANK_TRIAL_D_C, undefined);
});

// ─── IDEMPOTENCE ──────────────────────────────────────────────────────────────

test("M3_04 the Steven arrival hook is hidden on re-entry when steven_met=true", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM3StevenGate();
  // Trigger meeting via archive path once
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "hist_map_insight";
  state.world.locationId = "fer_city_archive";

  let view = await engine.present(state);
  assert.ok(
    view.choices.find((c) => c.id === "insight_steven_arrives"),
    "steven arrival hook must be visible before meeting"
  );

  state = await engine.choose(state, "insight_steven_arrives");
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "answer_old_maps");
  state = await engine.choose(state, "steven_notes_back_old");
  state = await engine.choose(state, "post_back_city_hub");

  // Return to the archive and go back to hist_map_insight (knowledge persists)
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "hist_map_insight";
  state.world.locationId = "fer_city_archive";

  view = await engine.present(state);
  assert.equal(
    view.choices.find((c) => c.id === "insight_steven_arrives"),
    undefined,
    "steven arrival hook must be hidden after steven_met=true"
  );
});

test("M3_04 the Steven arrival hook is hidden on re-entry when steven_declined_contact=true", async () => {
  const { engine } = await makeEngine(new SequenceDice([20]));
  let state = legalM3StevenGate();
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "hist_map_insight";
  state.world.locationId = "fer_city_archive";

  state = await engine.choose(state, "insight_steven_arrives");
  state = await engine.choose(state, "leave_without_meeting");

  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "hist_map_insight";
  state.world.locationId = "fer_city_archive";

  const view = await engine.present(state);
  assert.equal(
    view.choices.find((c) => c.id === "insight_steven_arrives"),
    undefined,
    "steven arrival hook must be hidden after steven_declined_contact=true"
  );
});

// ─── CROSS-SCENE ARRIVAL FROM OLD MAPS ────────────────────────────────────────

test("M3_04 cross-scene: hist_map_insight → insight_steven_arrives lands on steven_appears", async () => {
  const { engine } = await makeEngine();
  let state = legalM3StevenGate();
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "hist_map_insight";
  state.world.locationId = "fer_city_archive";

  state = await engine.choose(state, "insight_steven_arrives");
  assert.equal(state.story.sceneId, "m03-steven-enters");
  assert.equal(state.story.nodeId, "steven_appears");
});

test("M3_04 cross-scene: survey_report → report_steven_arrives lands on steven_appears", async () => {
  const { engine } = await makeEngine();
  let state = legalM3State();
  state.story.sceneId = "m03-old-maps";
  state.story.nodeId = "survey_report";
  state.world.locationId = "fer_city_archive";

  state = await engine.choose(state, "report_steven_arrives");
  assert.equal(state.story.sceneId, "m03-steven-enters");
  assert.equal(state.story.nodeId, "steven_appears");
  assert.equal(state.world.flags.ferrox_survey_report_read, true);
});

// ─── POST-HUB RETURN ──────────────────────────────────────────────────────────

test("M3_04 post_steven_hub routes back to Ferravia city_hub", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "answer_generic");
  state = await engine.choose(state, "steven_notes_back_generic");
  assert.equal(state.story.nodeId, "post_steven_hub");
  state = await engine.choose(state, "post_back_city_hub");
  assert.equal(state.story.sceneId, "m03-ferravia-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  assert.equal(state.world.locationId, "fer_city");
});

// ─── CALLBACK PRESERVATION ────────────────────────────────────────────────────

test("M3_04 preserves M01/M02 state through Steven meeting", async () => {
  const { engine } = await makeEngine();
  let state = legalM3StevenGate();
  state.world.flags.houndour_ginestre_disposition = "captured";
  state.world.flags.poaching_network_state = "resolved";
  state.world.flags.rookie_invitational_result = "second";
  state.player.money = 700;
  state.competition.history = [
    { matchId: "first_official_001", outcome: "win" },
    { matchId: "rank_e_to_d_001", outcome: "win" }
  ];
  enterSteven(state);

  state = await engine.choose(state, "introduce_self");
  state = await engine.choose(state, "answer_old_maps");
  state = await engine.choose(state, "steven_notes_back_old");

  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(state.world.flags.poaching_network_state, "resolved");
  assert.equal(state.world.flags.rookie_invitational_result, "second");
  assert.equal(state.world.flags.n_met, true);
  assert.equal(state.world.flags.friend_beat_01_friend_id, "Mattew");
  assert.equal(state.world.flags.friend_beat_02_friend_id, "Daniel");
  assert.equal(state.player.money, 700);
  assert.equal(state.competition.history.length, 2);
});

// ─── SAVE / RELOAD ────────────────────────────────────────────────────────────

test("M3_04 Steven-met state survives save/reload identically", async () => {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "m3-steven-save-"));
    const store = new SaveStore(tmpDir);
    const { engine } = await makeEngine();

    let state = enterSteven(legalM3StevenGate());
    state = await engine.choose(state, "introduce_self");
    state = await engine.choose(state, "answer_old_maps");
    state = await engine.choose(state, "steven_notes_back_old");

    state.slot = "slot1";
    await store.save(state);
    const loaded = await store.load("slot1");
    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.steven_met, true);
    assert.ok(loaded.npcs.Steven);
    assert.equal(loaded.npcs.Steven.state.role, "technical_observer");
    assert.equal(loaded.npcs.Steven.relationship.score, 10);
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  }
});


// ─── MODEL ALIGNMENT PASS ────────────────────────────────────────────────────

test("M3_04 deferred contact can be recovered and satisfies steven_met", async () => {
  const { engine } = await makeEngine();
  let state = legalM3StevenGate();
  state.world.flags.steven_declined_contact = true;
  state.story.sceneId = "m03-steven-enters";
  state.story.nodeId = "deferred_contact";
  state.world.locationId = "fer_city_archive";
  state = await engine.choose(state, "deferred_introduce");
  assert.equal(state.story.nodeId, "introduction_exchange");
  assert.equal(state.world.flags.steven_met, true);
  assert.equal(state.world.flags.steven_contact_recovered, true);
  assert.equal(state.npcs.Steven.state.role, "technical_observer");
});

test("M3_04 deferring twice never permanently removes the recovery route", async () => {
  const { engine } = await makeEngine();
  let state = legalM3StevenGate();
  state.world.flags.steven_declined_contact = true;
  state.story.sceneId = "m03-steven-enters";
  state.story.nodeId = "deferred_contact";
  state.world.locationId = "fer_city_archive";
  state = await engine.choose(state, "deferred_wait_again");
  state = await engine.choose(state, "post_back_city_hub");
  assert.equal(state.story.sceneId, "m03-ferravia-arrival");
  assert.equal(state.story.nodeId, "city_hub");
  const view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "hub_recontact_steven"));
  assert.equal(state.world.flags.steven_met, undefined);
});

test("M3_04 initial refusal records historical deferral without making it terminal", async () => {
  const { engine } = await makeEngine();
  let state = enterSteven(legalM3StevenGate());
  state = await engine.choose(state, "leave_without_meeting");
  assert.equal(state.world.flags.steven_declined_contact, true);
  assert.equal(state.world.flags.steven_contact_deferred, true);
  const view = await engine.present(state);
  assert.ok(view.choices.find((c) => c.id === "hub_recontact_steven"));
});
