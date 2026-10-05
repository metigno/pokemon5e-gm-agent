import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
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

// CB_01: A2_FRIEND_NEWS fires → friend_beat_02_complete → A2_ROOKIE_CUP fires (sequential event chain)
test("CB_01 friend_beat_02_complete triggers A2_ROOKIE_CUP on next hub move", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.friend_beat_02_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const next = await engine.choose(state, "sala_verde");

  assert.equal(next.events.A2_ROOKIE_CUP?.status, "resolved");
  assert.equal(next.world.flags.a2_rookie_cup_available, true);
  // A2_CRISIS_ESCALATES must NOT fire here — local_problem_started is not set
  assert.equal(next.events.A2_CRISIS_ESCALATES, undefined);
});

// CB_02: A2_ROOKIE_CUP does NOT fire without friend_beat_02_complete even if local_problem_started
test("CB_02 A2_ROOKIE_CUP blocked without friend_beat_02_complete despite other conditions", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.local_problem_started = true;
  state.world.day = 25;
  state.world.elapsedMinutes = 25 * 24 * 60;
  // friend_beat_02_complete deliberately absent
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const next = await engine.choose(state, "sala_verde");

  assert.equal(next.events.A2_ROOKIE_CUP, undefined);
  assert.equal(next.world.flags.a2_rookie_cup_available, undefined);
});

// CB_03: Both A2_ROOKIE_CUP and A2_CRISIS_ESCALATES can fire in same move
test("CB_03 A2_ROOKIE_CUP and A2_CRISIS_ESCALATES both fire in one choose when conditions met", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.friend_beat_02_complete = true;
  state.world.flags.local_problem_started = true;
  state.world.flags.local_problem_ignored = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const next = await engine.choose(state, "sala_verde");

  assert.equal(next.events.A2_ROOKIE_CUP?.status, "resolved");
  assert.equal(next.events.A2_CRISIS_ESCALATES?.status, "resolved");
  assert.equal(next.world.flags.a2_rookie_cup_available, true);
  assert.equal(next.world.flags.a2_crisis_escalates_available, true);
});

// CB_04: receive_friend_news and crisis_update both visible simultaneously
test("CB_04 receive_friend_news and crisis_update both visible in borough_hub simultaneously", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_friend_news_available = true;
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);

  assert.ok(view.choices.some((c) => c.id === "receive_friend_news"), "receive_friend_news must be visible");
  assert.ok(view.choices.some((c) => c.id === "crisis_update"), "crisis_update must be visible");
});

// CB_05: Fab ranger branch sets poaching_n_fab_connected — preserved through crisis moves
test("CB_05 poaching_n_fab_connected set in M2_08 is preserved through M2_10 crisis path", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.a2_friend_news_available = true;
  state.world.flags.friend_beat_02_friend_id = "Fab";
  state.world.flags.ranger_thread_opened = true;
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.flags.crisis_escalation_type = "network_unchecked";
  // Simulate having completed M2_08 with Fab + ranger share
  state.world.flags.poaching_n_fab_connected = true;
  state.world.flags.friend_beat_02_complete = true;
  // Now in M2_10
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-crisis-moves";
  state.story.nodeId = "crisis_news_arrive";

  state = await engine.choose(state, "read_network_unchecked");
  state = await engine.choose(state, "unchecked_assess");
  state = await engine.choose(state, "assess_report_ranger");
  state = await engine.choose(state, "report_full_detail");
  state = await engine.choose(state, "close_ranger_alerted");
  state = await engine.choose(state, "back_to_borgo_crisis");

  assert.equal(state.world.flags.poaching_n_fab_connected, true, "poaching_n_fab_connected must survive M2_10");
  assert.equal(state.world.flags.crisis_moves_complete, true);
  assert.equal(state.world.flags.crisis_ranger_alerted, true);
});

// CB_06: poaching_network_state not overwritten by M2_10 regardless of path
test("CB_06 M2_10 never overwrites poaching_network_state set by M2_07", async () => {
  const { engine } = await makeEngine();
  const values = ["avoided", "intervened", "partial", "escalated"];

  for (const v of values) {
    let state = legalM2State();
    state.world.flags.a2_crisis_escalates_available = true;
    state.world.flags.crisis_escalation_type = "silent_spread";
    state.world.flags.poaching_network_state = v;
    state.world.locationId = "borgo_salice";
    state.story.sceneId = "m02-crisis-moves";
    state.story.nodeId = "crisis_news_arrive";

    state = await engine.choose(state, "read_silent_spread");
    state = await engine.choose(state, "silent_continue_ignore");
    state = await engine.choose(state, "defer_walk_away");
    state = await engine.choose(state, "back_to_borgo_crisis");

    assert.equal(state.world.flags.poaching_network_state, v,
      `poaching_network_state="${v}" must not be changed by M2_10`);
  }
});

// CB_07: rookie_cup_complete hides check_rookie_cup; crisis_moves_complete hides crisis_update
test("CB_07 completion flags hide their respective hub choices correctly", async () => {
  const { engine } = await makeEngine();

  // Both complete
  const state = legalM2State();
  state.world.flags.a2_rookie_cup_available = true;
  state.world.flags.rookie_cup_complete = true;
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.flags.crisis_moves_complete = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "sala_verde";

  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "check_rookie_cup"), false,
    "check_rookie_cup must be hidden after rookie_cup_complete");

  const state2 = legalM2State();
  state2.world.flags.a2_crisis_escalates_available = true;
  state2.world.flags.crisis_moves_complete = true;
  state2.world.flags.a2_friend_news_available = false;
  state2.world.locationId = "borgo_salice";
  state2.story.sceneId = "m02-borgo-salice";
  state2.story.nodeId = "borough_hub";

  const view2 = await engine.present(state2);
  assert.equal(view2.choices.some((c) => c.id === "crisis_update"), false,
    "crisis_update must be hidden after crisis_moves_complete");
});

// CB_08: Full M2_08→M2_09→M2_10 linear happy path — all three blocks complete without rank change
test("CB_08 linear path M2_08 decline + M2_09 decline + M2_10 defer leaves rank=E with all complete flags", async () => {
  const { engine } = await makeEngine();

  // M2_08: Daniel path (default friend), just complete
  let state = legalM2State();
  state.world.flags.a2_friend_news_available = true;
  state.world.flags.friend_beat_02_friend_id = "Daniel";
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-friend-beat-02";
  state.story.nodeId = "friend_news_arrive";

  state = await engine.choose(state, "read_daniel_update");
  state = await engine.choose(state, "reply_brief_daniel");
  state = await engine.choose(state, "close_daniel_brief");
  state = await engine.choose(state, "back_to_borgo");

  assert.equal(state.world.flags.friend_beat_02_complete, true, "M2_08 must complete");
  assert.equal(state.competition.rank, "E");

  // M2_09: decline cup
  state.world.flags.a2_rookie_cup_available = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-rookie-invitational";
  state.story.nodeId = "cup_announcement";

  state = await engine.choose(state, "decline_cup");
  state = await engine.choose(state, "back_to_borgo_declined");

  assert.equal(state.world.flags.rookie_cup_complete, true, "M2_09 must complete");
  assert.equal(state.world.flags.rookie_cup_result, "declined");
  assert.equal(state.competition.rank, "E");

  // M2_10: defer walk away
  state.world.flags.a2_crisis_escalates_available = true;
  state.world.flags.crisis_escalation_type = "partial_response";
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-crisis-moves";
  state.story.nodeId = "crisis_news_arrive";

  state = await engine.choose(state, "read_partial_response");
  state = await engine.choose(state, "partial_step_back");
  state = await engine.choose(state, "defer_walk_away");
  state = await engine.choose(state, "back_to_borgo_crisis");

  assert.equal(state.world.flags.crisis_moves_complete, true, "M2_10 must complete");
  assert.equal(state.world.flags.local_problem_ignored, true);
  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
  assert.equal(state.story.sceneId, "m02-borgo-salice");
});
