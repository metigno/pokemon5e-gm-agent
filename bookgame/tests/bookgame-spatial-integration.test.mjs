import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-04T11:20:00.000Z";

function firstRoadState() {
  const state = firstRoadState();
  state.world.locationId = "asteria_ginestre";
  state.story.sceneId = "first-road";
  state.story.nodeId = "arrival";
  return state;
}

test("authored combat handoff carries trainer state and spatial coordinates", async () => {
  const book = new BookgameEngine({ now: fixedNow });
  let state = firstRoadState();
  state.player.inventory = ["Great Ball"];
  state.player.trainerLevel = 5;

  state = await book.choose(state, "send_starter");

  assert.equal(state.pending.trainer.name, "Luke");
  assert.equal(state.pending.trainer.level, 5);
  assert.deepEqual(state.pending.trainer.inventory, ["Great Ball"]);
  assert.deepEqual(state.pending.playerPosition, { x: 0, y: 0 });
  assert.deepEqual(state.pending.trainerPosition, { x: 0, y: 0 });
  assert.deepEqual(state.pending.opponentPosition, { x: 20, y: 0 });
  assert.equal(state.pending.returnNodes.captured, "houndour_captured");
});

test("capture outcome returns to authored branch and persists inventory plus roster", async () => {
  const book = new BookgameEngine({ now: fixedNow });
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 5, 20])
  });

  let state = firstRoadState();
  state.player.inventory = ["Great Ball"];
  state.player.trainerLevel = 5;
  state = await book.choose(state, "send_starter");

  let battle = await combat.createBattle(state.pending);
  const capture = await combat.attemptPlayerCapture(battle, "great-ball");
  battle = capture.battle;

  assert.equal(capture.result.captured, true);
  assert.equal(battle.outcome, "captured");

  state = book.setCombatState(state, battle);
  state = book.resolveCombatHandoff(state, "captured");

  assert.equal(state.pending, null);
  assert.equal(state.story.nodeId, "houndour_captured");
  assert.deepEqual(state.player.inventory, []);
  assert.equal(state.player.roster.length, 2);
  assert.equal(state.player.roster[1].speciesId, "houndour");
  assert.equal(state.player.roster[1].level, 3);
  assert.equal(state.player.roster[1].capturedAt.encounterId, "HOUNDOUR_GINESTRE_001");
});
