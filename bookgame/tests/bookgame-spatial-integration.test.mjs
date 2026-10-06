import test from "node:test";
import assert from "node:assert/strict";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-04T11:20:00.000Z";

function firstRoadState() {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
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
  state.player.hp = { current: 17, max: 22 };
  state.player.ac = 13;
  state.player.classResources = { "battle-dice": { current: 2, max: 3 } };
  state.player.conditions = ["poisoned"];

  state = await book.choose(state, "send_starter");

  assert.equal(state.pending.trainer.name, "Luke");
  assert.equal(state.pending.trainer.level, 5);
  assert.deepEqual(state.pending.trainer.inventory, ["Great Ball"]);
  assert.deepEqual(state.pending.trainer.hp, { current: 17, max: 22 });
  assert.equal(state.pending.trainer.ac, 13);
  assert.deepEqual(state.pending.trainer.classResources, { "battle-dice": { current: 2, max: 3 } });
  assert.deepEqual(state.pending.trainer.conditions, ["poisoned"]);
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


test("combat loads and returns persistent Pokemon progression fields instead of resetting to species defaults", async () => {
  const book = new BookgameEngine({ now: fixedNow });
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([15, 8, 1, 1, 1, 1])
  });

  let state = firstRoadState();
  const starter = {
    ...state.player.starter,
    rosterIndex: 0,
    xp: 800,
    ac: 19,
    hp: { current: 31, max: 44 },
    attributes: { STR: 14, DEX: 16, CON: 13, INT: 8, WIS: 12, CHA: 11 },
    savingThrows: ["DEX", "WIS"],
    proficiencies: ["Athletics", "Perception"],
    hitDice: { die: "d10", current: 4, max: 5 },
    bond: { level: 2, points: { current: 1, max: 3 } },
    gender: "male",
    nature: "Jolly",
    evolutionHistory: [{ evolutionId: "example", from: "a", to: "b", level: 4 }],
    pendingMoveLearning: [{ moveId: "roar", level: 6 }],
    pendingMoveChoices: [{ level: 6, availableMoveIds: ["roar"], maxReplacements: 1 }],
    pendingAsiChoices: [{ level: 8, points: 3, maxScore: 20, kind: "asi-or-feat" }]
  };
  state.player.roster = [starter];
  state.player.starter = { ...starter };
  state = await book.choose(state, "send_starter");

  let battle = await combat.createBattle(state.pending);
  assert.equal(battle.player.ac, 19);
  assert.deepEqual(battle.player.hp, { current: 31, max: 44 });
  assert.deepEqual(battle.player.attributes, starter.attributes);
  assert.equal(battle.player.xp, 800);
  assert.deepEqual(battle.player.hitDice, starter.hitDice);
  assert.deepEqual(battle.player.bond, starter.bond);

  battle.outcome = "fled";
  state = book.setCombatState(state, battle);
  state = book.resolveCombatHandoff(state, "fled");

  assert.equal(state.player.roster[0].ac, 19);
  assert.deepEqual(state.player.roster[0].hp, { current: 31, max: 44 });
  assert.equal(state.player.roster[0].xp, 800);
  assert.deepEqual(state.player.roster[0].attributes, starter.attributes);
  assert.deepEqual(state.player.roster[0].pendingMoveChoices, starter.pendingMoveChoices);
  assert.deepEqual(state.player.roster[0].pendingAsiChoices, starter.pendingAsiChoices);
});
