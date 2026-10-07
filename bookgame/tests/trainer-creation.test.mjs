import test from "node:test";
import assert from "node:assert/strict";
import { assertTrainerCreationComplete, completeTrainerCreation, createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-07T10:55:00.000Z";

test("new game cannot silently skip Pokemon 5e Trainer creation", () => {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  assert.equal(state.player.trainerClass, "Trainer");
  assert.equal(state.player.trainerLevel, 1);
  assert.equal(state.player.trainerPath, null);
  assert.deepEqual(state.player.specializations, []);
  assert.equal(state.player.pokeslots, 3);
  assert.equal(state.player.maxSr, 2);
  assert.equal(state.world.flags.character_creation_complete, false);
  assert.equal(state.world.flags.intro_complete, false);
  assert.equal(state.world.flags.free_roam, false);
  assert.throws(() => assertTrainerCreationComplete(state), /specialization/i);
});

test("level 1 completion requires specialization and does not invent a Trainer Path", () => {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  assert.throws(() => completeTrainerCreation(state, {}), /specialization/i);
  const ready = completeTrainerCreation(state, { specialization: "Fire" });
  assert.deepEqual(ready.player.specializations, ["Fire"]);
  assert.equal(ready.player.trainerPath, null);
  assert.equal(ready.player.characterCreation.complete, true);
  assert.equal(ready.world.flags.character_creation_complete, true);
  assert.equal(assertTrainerCreationComplete(ready), true);
});

test("Pokemon 5e starting Trainer gear is represented in durable state", () => {
  const state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  assert.equal(state.player.inventory.filter((x) => x === "Pokeball").length, 5);
  assert.ok(state.player.inventory.includes("Potion"));
  assert.ok(state.player.inventory.includes("Trainer License"));
  assert.ok(state.player.inventory.includes("Pokedex"));
});
