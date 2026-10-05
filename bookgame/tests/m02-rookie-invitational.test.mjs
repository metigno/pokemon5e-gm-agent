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

function legalCupState(protagonist = "Luke") {
  const state = legalM2State(protagonist);
  state.world.flags.friend_beat_02_complete = true;
  state.world.flags.a2_rookie_cup_available = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-rookie-invitational";
  state.story.nodeId = "cup_announcement";
  return state;
}

test("M2_09 scene compiles and cup_announcement node is present", async () => {
  const { bundle } = await makeEngine();
  const scene = bundle.scenes["m02-rookie-invitational"];
  assert.ok(scene, "m02-rookie-invitational must compile");
  assert.ok(scene.nodes["cup_announcement"], "cup_announcement must exist");
  assert.equal(scene.moduleId, "M02");
  assert.equal(scene.locationId, "borgo_salice_sala_verde");
});

test("M2_09 scene requires a2_rookie_cup_available entry condition", async () => {
  const { engine } = await makeEngine();

  const legal = legalCupState();
  const view = await engine.present(legal);
  assert.ok(view, "legal state must present without error");

  for (const mutate of [
    (s) => { s.world.flags.m1_complete = false; },
    (s) => { s.world.flags.m02_unlocked = false; },
    (s) => { s.world.flags.m2_active = false; },
    (s) => { s.competition.rank = "F"; s.competition.rankOrder = 0; },
    (s) => { s.world.flags.a2_rookie_cup_available = false; }
  ]) {
    const state = legalCupState();
    mutate(state);
    await assert.rejects(
      () => engine.present(state),
      /Scene conditions are not satisfied/
    );
  }
});

test("M2_09 register_for_cup and decline_cup hidden after registration", async () => {
  const { engine } = await makeEngine();
  const state = legalCupState();
  state.world.flags.rookie_cup_registered = true;

  const view = await engine.present(state);
  assert.equal(view.choices.some((c) => c.id === "register_for_cup"), false);
  assert.equal(view.choices.some((c) => c.id === "decline_cup"), false);
  assert.ok(view.choices.some((c) => c.id === "enter_registered_cup"), "enter_registered_cup visible after registration");
});

test("M2_09 register_for_cup sets rookie_cup_registered and reaches registration", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "register_for_cup");

  assert.equal(state.story.nodeId, "cup_registration");
  assert.equal(state.world.flags.rookie_cup_registered, true);
});

test("M2_09 decline path sets rookie_cup_declined and rookie_cup_complete", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "decline_cup");
  state = await engine.choose(state, "back_to_borgo_declined");

  assert.equal(state.world.flags.rookie_cup_declined, true);
  assert.equal(state.world.flags.rookie_cup_complete, true);
  assert.equal(state.world.flags.rookie_cup_result, "declined");
  assert.equal(state.story.sceneId, "m02-borgo-salice");
});

test("M2_09 ask_about_cup reaches cup_info with register and decline options", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "ask_about_cup");

  assert.equal(state.story.nodeId, "cup_info");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "register_after_info"));
  assert.ok(view.choices.some((c) => c.id === "decline_after_info"));
});

test("M2_09 withdraw_registration sets rookie_cup_declined and rookie_cup_withdrew", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "register_for_cup");
  state = await engine.choose(state, "withdraw_registration");
  state = await engine.choose(state, "back_to_borgo_declined");

  assert.equal(state.world.flags.rookie_cup_withdrew, true);
  assert.equal(state.world.flags.rookie_cup_complete, true);
  assert.equal(state.world.flags.rookie_cup_result, "declined");
});

test("M2_09 forfeit_r1 sets rookie_cup_forfeited and rookie_cup_complete", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "register_for_cup");
  state = await engine.choose(state, "proceed_to_r1");
  state = await engine.choose(state, "forfeit_r1");
  state = await engine.choose(state, "back_to_borgo_forfeit");

  assert.equal(state.world.flags.rookie_cup_forfeited, true);
  assert.equal(state.world.flags.rookie_cup_complete, true);
  assert.equal(state.world.flags.rookie_cup_result, "forfeited");
});

test("M2_09 cup_r1_handoff has fight_r1 combat choice", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "register_for_cup");
  state = await engine.choose(state, "proceed_to_r1");
  state = await engine.choose(state, "enter_r1_fight");

  assert.equal(state.story.nodeId, "cup_r1_handoff");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "fight_r1"), "fight_r1 must be present");
});

test("M2_09 cup_r1_scout sets rookie_cup_r1_scouted flag", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "register_for_cup");
  state = await engine.choose(state, "proceed_to_r1");
  state = await engine.choose(state, "scout_r1_opponent");
  state = await engine.choose(state, "fight_after_scout");

  assert.equal(state.world.flags.rookie_cup_r1_scouted, true);
  assert.equal(state.story.nodeId, "cup_r1_handoff");
});

test("M2_09 r1_win_result sets r1_result=win and reaches r2", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();
  state.story.nodeId = "cup_r1_win";
  state.world.flags.rookie_cup_registered = true;

  state = await engine.choose(state, "continue_to_r2");

  assert.equal(state.world.flags.rookie_cup_r1_result, "win");
  assert.equal(state.story.nodeId, "cup_r2_announce");
});

test("M2_09 r1_loss reaches cup_result_loss with complete flag", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();
  state.story.nodeId = "cup_r1_loss";
  state.world.flags.rookie_cup_registered = true;

  state = await engine.choose(state, "accept_r1_loss");
  state = await engine.choose(state, "back_to_borgo_loss");

  assert.equal(state.world.flags.rookie_cup_r1_result, "loss");
  assert.equal(state.world.flags.rookie_cup_complete, true);
  assert.equal(state.world.flags.rookie_cup_result, "loss");
});

test("M2_09 r2_handoff has fight_r2 combat choice", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();
  state.story.nodeId = "cup_r2_announce";
  state.world.flags.rookie_cup_registered = true;

  state = await engine.choose(state, "enter_r2_fight");

  assert.equal(state.story.nodeId, "cup_r2_handoff");
  const view = await engine.present(state);
  assert.ok(view.choices.some((c) => c.id === "fight_r2"), "fight_r2 must be present");
});

test("M2_09 r2_win sets complete and result=win", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();
  state.story.nodeId = "cup_r2_win";
  state.world.flags.rookie_cup_registered = true;

  state = await engine.choose(state, "accept_cup_win");
  state = await engine.choose(state, "back_to_borgo_win");

  assert.equal(state.world.flags.rookie_cup_r2_result, "win");
  assert.equal(state.world.flags.rookie_cup_result, "win");
  assert.equal(state.world.flags.rookie_cup_complete, true);
  assert.equal(state.story.sceneId, "m02-borgo-salice");
  assert.equal(state.world.locationId, "borgo_salice");
});

test("M2_09 r2_loss sets complete and result=loss", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();
  state.story.nodeId = "cup_r2_loss";
  state.world.flags.rookie_cup_registered = true;

  state = await engine.choose(state, "accept_r2_loss");
  state = await engine.choose(state, "back_to_borgo_loss");

  assert.equal(state.world.flags.rookie_cup_r2_result, "loss");
  assert.equal(state.world.flags.rookie_cup_result, "loss");
  assert.equal(state.world.flags.rookie_cup_complete, true);
});

test("M2_09 withdraw_before_r2 sets r2_withdrew and result=loss", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();
  state.story.nodeId = "cup_r2_announce";
  state.world.flags.rookie_cup_registered = true;

  state = await engine.choose(state, "withdraw_before_r2");
  state = await engine.choose(state, "back_to_borgo_loss");

  assert.equal(state.world.flags.rookie_cup_r2_withdrew, true);
  assert.equal(state.world.flags.rookie_cup_complete, true);
});

test("M2_09 no Rank change through any branch", async () => {
  const { engine } = await makeEngine();
  let state = legalCupState();

  state = await engine.choose(state, "decline_cup");
  state = await engine.choose(state, "back_to_borgo_declined");

  assert.equal(state.competition.rank, "E");
  assert.equal(state.competition.rankOrder, 1);
});

test("M2_09 A2_ROOKIE_CUP fires when friend_beat_02_complete and rank=E", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.flags.friend_beat_02_complete = true;
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_ROOKIE_CUP?.status, "resolved");
  assert.equal(state.world.flags.a2_rookie_cup_available, true);
});

test("M2_09 check_rookie_cup visible in sala_verde with a2_rookie_cup_available", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_rookie_cup_available = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "sala_verde";

  const view = await engine.present(state);
  assert.ok(
    view.choices.some((c) => c.id === "check_rookie_cup"),
    "check_rookie_cup must be visible with a2_rookie_cup_available"
  );
});

test("M2_09 check_rookie_cup hidden after rookie_cup_complete", async () => {
  const { engine } = await makeEngine();
  const state = legalM2State();
  state.world.flags.a2_rookie_cup_available = true;
  state.world.flags.rookie_cup_complete = true;
  state.world.locationId = "borgo_salice_sala_verde";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "sala_verde";

  const view = await engine.present(state);
  assert.equal(
    view.choices.some((c) => c.id === "check_rookie_cup"),
    false,
    "check_rookie_cup must be hidden after completion"
  );
});

test("M2_09 A2_ROOKIE_CUP does NOT fire without friend_beat_02_complete", async () => {
  const { engine } = await makeEngine();
  let state = legalM2State();
  state.world.locationId = "borgo_salice";
  state.story.sceneId = "m02-borgo-salice";
  state.story.nodeId = "borough_hub";

  state = await engine.choose(state, "sala_verde");

  assert.equal(state.events.A2_ROOKIE_CUP, undefined);
  assert.equal(state.world.flags.a2_rookie_cup_available, undefined);
});

test("M2_09 save/reload preserves rookie_cup state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m2-cup-"));
  try {
    const { engine } = await makeEngine();
    const store = new SaveStore(dir);
    let state = legalCupState("Luke");
    state.slot = "m2-rookie-cup-test";

    state = await engine.choose(state, "decline_cup");
    state = await engine.choose(state, "back_to_borgo_declined");

    await store.save(state);
    const loaded = await store.load("m2-rookie-cup-test");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.rookie_cup_complete, true);
    assert.equal(loaded.world.flags.rookie_cup_result, "declined");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
