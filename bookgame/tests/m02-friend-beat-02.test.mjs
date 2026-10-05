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

function legalFriendBeatState(friendId = "Mattew", protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.a2_friend_news_available = true;
  state.world.flags.friend_beat_02_friend_id = friendId;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-friend-beat-02";
  state.story.nodeId = "friend_news_arrive";
  return state;
}

test("M2_08 scene compiles and friend_news_arrive node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-friend-beat-02"];
  assert.ok(scene, "m02-friend-beat-02 must compile");
  assert.ok(scene.nodes["friend_news_arrive"], "friend_news_arrive must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice");
});

test("M2_08 scene requires a2_friend_news_available entry condition", async () => {
  const { engine } = await makeEngine();

  const legal = legalFriendBeatState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; },
    (s) => { s.world.flags.friends_split = false; },
    (s) => { s.world.flags.a2_friend_news_available = false; }
  ]) {
    const state = legalFriendBeatState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_08 read_mattew_update visible when friend_id=Mattew", async () => {
  const { engine } = await makeEngine();
  const state = legalFriendBeatState("Mattew");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_mattew_update"), "read_mattew_update must be visible");
  assert.equal(view.choices.some((c) => c.id === "read_daniel_update"), false);
  assert.equal(view.choices.some((c) => c.id === "read_edward_update"), false);
  assert.equal(view.choices.some((c) => c.id === "read_fab_update"), false);
});

test("M2_08 read_daniel_update visible when friend_id=Daniel", async () => {
  const { engine } = await makeEngine();
  const state = legalFriendBeatState("Daniel");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_daniel_update"), "read_daniel_update must be visible");
  assert.equal(view.choices.some((c) => c.id === "read_mattew_update"), false);
});

test("M2_08 read_edward_update visible when friend_id=Edward", async () => {
  const { engine } = await makeEngine();
  const state = legalFriendBeatState("Edward");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_edward_update"), "read_edward_update must be visible");
  assert.equal(view.choices.some((c) => c.id === "read_mattew_update"), false);
});

test("M2_08 read_fab_update visible when friend_id=Fab", async () => {
  const { engine } = await makeEngine();
  const state = legalFriendBeatState("Fab");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "read_fab_update"), "read_fab_update must be visible");
  assert.equal(view.choices.some((c) => c.id === "read_mattew_update"), false);
});

test("M2_08 Mattew spar path sets type=combat and reaches mattew_combat_handoff", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Mattew");

  state = await engine.choose(state, "read_mattew_update");
  state = await engine.choose(state, "accept_mattew_spar");

  assert.equal(state.story.nodeId, "mattew_combat_handoff");
  assert.equal(state.world.flags.friend_beat_02_type, "combat");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "fight_mattew"), "fight_mattew must be present");
});

test("M2_08 Mattew conversation path sets type=conversation", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Mattew");

  state = await engine.choose(state, "read_mattew_update");
  state = await engine.choose(state, "talk_to_mattew");

  assert.equal(state.story.nodeId, "mattew_conversation");
  assert.equal(state.world.flags.friend_beat_02_type, "conversation");
});

test("M2_08 Mattew progress_detail then spar works", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Mattew");

  state = await engine.choose(state, "read_mattew_update");
  state = await engine.choose(state, "ask_mattew_progress");
  state = await engine.choose(state, "offer_spar_after_detail");

  assert.equal(state.story.nodeId, "mattew_combat_handoff");
  assert.equal(state.world.flags.friend_beat_02_type, "combat");
});

test("M2_08 Mattew spar reaches mattew_combat_handoff with fight_mattew choice", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Mattew");

  state = await engine.choose(state, "read_mattew_update");
  state = await engine.choose(state, "accept_mattew_spar");

  assert.equal(state.story.nodeId, "mattew_combat_handoff");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "fight_mattew"), "fight_mattew must be present");
});

test("M2_08 Mattew win node sets friend_beat_02_complete on close", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Mattew");
  state.story.nodeId = "mattew_combat_win";
  state.world.flags.friend_beat_02_type = "combat";

  state = await engine.choose(state, "close_after_win");

  assert.equal(state.story.nodeId, "friend_beat_close");

  state = await engine.choose(state, "back_to_borgo");

  assert.equal(state.world.flags.friend_beat_02_complete, true);
  assert.equal(state.story.sceneId, "m02-borgo-salice");
});

test("M2_08 Mattew lose node routes to friend_beat_close", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Mattew");
  state.story.nodeId = "mattew_combat_lose";
  state.world.flags.friend_beat_02_type = "combat";

  state = await engine.choose(state, "close_after_loss");

  assert.equal(state.story.nodeId, "friend_beat_close");
});

test("M2_08 Daniel engaged path sets type=conversation", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Daniel");

  state = await engine.choose(state, "read_daniel_update");
  state = await engine.choose(state, "reply_engage_daniel");

  assert.equal(state.story.nodeId, "daniel_engaged");
  assert.equal(state.world.flags.friend_beat_02_type, "conversation");
});

test("M2_08 Daniel brief path sets type=remote_brief", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Daniel");

  state = await engine.choose(state, "read_daniel_update");
  state = await engine.choose(state, "reply_brief_daniel");

  assert.equal(state.story.nodeId, "daniel_brief");
  assert.equal(state.world.flags.friend_beat_02_type, "remote_brief");
});

test("M2_08 Daniel brief sets friend_beat_02_complete on close", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Daniel");

  state = await engine.choose(state, "read_daniel_update");
  state = await engine.choose(state, "reply_brief_daniel");
  state = await engine.choose(state, "close_daniel_brief");
  state = await engine.choose(state, "back_to_borgo");

  assert.equal(state.world.flags.friend_beat_02_complete, true);
  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.world.locationId, "borgo_salice");
});

test("M2_08 Edward spar path reaches edward_combat_handoff", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Edward");

  state = await engine.choose(state, "read_edward_update");
  state = await engine.choose(state, "accept_edward_spar");

  assert.equal(state.story.nodeId, "edward_combat_handoff");
  assert.equal(state.world.flags.friend_beat_02_type, "combat");

  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "fight_edward"), "fight_edward must be present");
});

test("M2_08 Edward conversation path sets type=conversation", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Edward");

  state = await engine.choose(state, "read_edward_update");
  state = await engine.choose(state, "talk_to_edward");

  assert.equal(state.story.nodeId, "edward_conversation");
  assert.equal(state.world.flags.friend_beat_02_type, "conversation");
});

test("M2_08 Edward ecology note path sets ecology_context flag", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Edward");

  state = await engine.choose(state, "read_edward_update");
  state = await engine.choose(state, "ask_edward_ecology");
  state = await engine.choose(state, "spar_after_ecology");

  assert.equal(state.world.flags.friend_beat_02_ecology_context, true);
  assert.equal(state.story.nodeId, "edward_combat_handoff");
});

test("M2_08 Fab compare_notes hidden without poaching_network_state", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Fab");

  state = await engine.choose(state, "read_fab_update");

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "compare_fab_notes"),
    false,
    "compare_fab_notes must be hidden without poaching_network_state"
  );
});

test("M2_08 Fab compare_notes visible with poaching_network_state set", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Fab");
  state.world.flags.poaching_network_state = "investigating";

  state = await engine.choose(state, "read_fab_update");

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "compare_fab_notes"),
    "compare_fab_notes must be visible with poaching_network_state"
  );
});

test("M2_08 Fab intel path sets type=intelligence_share", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Fab");
  state.world.flags.poaching_network_state = "investigating";

  state = await engine.choose(state, "read_fab_update");
  state = await engine.choose(state, "compare_fab_notes");

  assert.equal(state.story.nodeId, "fab_network_intel");
  assert.equal(state.world.flags.friend_beat_02_type, "intelligence_share");
});

test("M2_08 Fab share_ranger_context hidden without ranger_thread_opened", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Fab");
  state.world.flags.poaching_network_state = "investigating";

  state = await engine.choose(state, "read_fab_update");
  state = await engine.choose(state, "compare_fab_notes");

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "share_ranger_context"),
    false,
    "share_ranger_context must be hidden without ranger_thread_opened"
  );
});

test("M2_08 Fab share_ranger_context visible with ranger_thread_opened", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Fab");
  state.world.flags.poaching_network_state = "investigating";
  state.world.flags.ranger_thread_opened = true;

  state = await engine.choose(state, "read_fab_update");
  state = await engine.choose(state, "compare_fab_notes");

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "share_ranger_context"),
    "share_ranger_context must be visible with ranger_thread_opened"
  );
});

test("M2_08 Fab ranger link path sets poaching_n_fab_connected", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Fab");
  state.world.flags.poaching_network_state = "investigating";
  state.world.flags.ranger_thread_opened = true;

  state = await engine.choose(state, "read_fab_update");
  state = await engine.choose(state, "compare_fab_notes");
  state = await engine.choose(state, "share_ranger_context");

  assert.equal(state.world.flags.poaching_n_fab_connected, true);
});

test("M2_08 no Rank change through any branch", async () => {
  const { engine } = await makeEngine();
  let state = legalFriendBeatState("Daniel");

  state = await engine.choose(state, "read_daniel_update");
  state = await engine.choose(state, "reply_brief_daniel");
  state = await engine.choose(state, "close_daniel_brief");
  state = await engine.choose(state, "back_to_borgo");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("M2_08 A2_FRIEND_NEWS event fires with friends_split and trainerLevel>=4", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.player.trainerLevel = 4;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_FRIEND_NEWS?.status, "resolved");
  assert.ok(state.world.flags.a2_friend_news_available, "a2_friend_news_available must be set");
  assert.ok(state.world.flags.friend_beat_02_friend_id, "friend_beat_02_friend_id must be set");
});

test("M2_08 A2_FRIEND_NEWS selects Fab when ranger_thread_opened and Fab is on ranger_route", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.player.trainerLevel = 4;
  state.world.flags.ranger_thread_opened = true;
  state.npcs.Fab = state.npcs.Fab ?? {};
  state.npcs.Fab.state = state.npcs.Fab.state ?? {};
  state.npcs.Fab.state.fiveRoadsPath = "ranger_route";
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.world.flags.friend_beat_02_friend_id, "Fab");
});

test("M2_08 borough_hub receive_friend_news choice visible with a2_friend_news_available", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_friend_news_available = true;
  state.world.flags.friend_beat_02_friend_id = "Mattew";
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "receive_friend_news"),
    "receive_friend_news must be visible with a2_friend_news_available"
  );
});

test("M2_08 receive_friend_news hidden after friend_beat_02_complete", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_friend_news_available = true;
  state.world.flags.friend_beat_02_friend_id = "Mattew";
  state.world.flags.friend_beat_02_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "receive_friend_news"),
    false,
    "receive_friend_news must be hidden after completion"
  );
});

test("M2_08 save/reload preserves friend_beat_02 state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-friend-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalFriendBeatState("Daniel", "Luke");
    state.slot = "m2-friend-beat-test";

    state = await engine.choose(state, "read_daniel_update");
    state = await engine.choose(state, "reply_brief_daniel");
    state = await engine.choose(state, "close_daniel_brief");
    state = await engine.choose(state, "back_to_borgo");

    await store.save(state);
    const loaded = await store.load("m2-friend-beat-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.friend_beat_02_complete, true);
    assert.equal(loaded.world.flags.friend_beat_02_friend_id, "Daniel");
    assert.equal(loaded.world.flags.friend_beat_02_type, "remote_brief");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
