import test from "node:test";
import assert from "node:assert/strict";
import { assertTrainerCreationComplete, completeTrainerCreation, createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-07T10:55:00.000Z";

test("new game cannot silently skip Pokemon 5e Trainer creation", () => {
  const state = createNewGameState({ protagonist: "Luke", startAtIntro: true, now: fixedNow });
  assert.equal(state.player.trainerClass, "pokemon-trainer");
  assert.equal(state.player.trainerLevel, 1);
  assert.equal(state.player.trainerPath, null);
  assert.equal(state.player.specializations.fire, 0);
  assert.equal(state.player.pokeslots, 3);
  assert.equal(state.player.maxSr, 2);
  assert.equal(state.world.flags.character_creation_complete, false);
  assert.equal(state.world.flags.intro_complete, false);
  assert.equal(state.world.flags.free_roam, false);
  assert.throws(() => assertTrainerCreationComplete(state), /specialization/i);
});

test("level 1 completion requires specialization and does not invent a Trainer Path", () => {
  const state = createNewGameState({ protagonist: "Luke", startAtIntro: true, now: fixedNow });
  assert.throws(() => completeTrainerCreation(state, {}), /specialization/i);
  const ready = completeTrainerCreation(state, { specialization: "fire" });
  assert.equal(ready.player.specializations.fire, 1);
  assert.equal(ready.player.trainerPath, null);
  assert.equal(ready.player.characterCreation.complete, true);
  assert.equal(ready.world.flags.character_creation_complete, true);
  assert.equal(assertTrainerCreationComplete(ready), true);
});

test("Pokemon 5e starting Trainer gear is represented in durable state", () => {
  const state = createNewGameState({ protagonist: "Luke", startAtIntro: true, now: fixedNow });
  assert.equal(state.player.inventory.filter((x) => x === "Pokeball").length, 5);
  assert.ok(state.player.inventory.includes("Potion"));
  assert.ok(state.player.inventory.includes("Trainer License"));
  assert.ok(state.player.inventory.includes("Pokedex"));
});


const FIVE_CANON = {
  Luke: { abilities: { STR: 13, DEX: 14, CON: 15, INT: 12, WIS: 8, CHA: 10 }, npcPath: "Tactician", npcSpec: "fire" },
  Mattew: { abilities: { STR: 10, DEX: 13, CON: 12, INT: 14, WIS: 8, CHA: 15 }, npcPath: "Poké Mentor", npcSpec: "electric" },
  Daniel: { abilities: { STR: 8, DEX: 13, CON: 10, INT: 12, WIS: 15, CHA: 14 }, npcPath: "Pokémon Collector", npcSpec: "ghost" },
  Edward: { abilities: { STR: 14, DEX: 15, CON: 13, INT: 8, WIS: 10, CHA: 12 }, npcPath: "Ace Trainer", npcSpec: "water" },
  Fab: { abilities: { STR: 8, DEX: 10, CON: 13, INT: 12, WIS: 14, CHA: 15 }, npcPath: "Commander", npcSpec: "poison" }
};

test("choosing a Five locks identity and stats but never inherits the NPC scripted path", () => {
  for (const [name, canon] of Object.entries(FIVE_CANON)) {
    const state = createNewGameState({ protagonist: name, startAtIntro: true, now: fixedNow });
    assert.deepEqual(state.player.abilities, canon.abilities, name);
    assert.equal(state.player.trainerPath, null, name);
    assert.equal(state.player.characterCreation.complete, false, name);
  }
});

test("the four unchosen Five keep canonical NPC path and starter-type specialization", () => {
  for (const protagonist of Object.keys(FIVE_CANON)) {
    const state = createNewGameState({ protagonist, startAtIntro: true, now: fixedNow });
    for (const [name, canon] of Object.entries(FIVE_CANON)) {
      if (name === protagonist) {
        assert.equal(state.npcs[name], undefined, name);
        continue;
      }
      assert.deepEqual(state.npcs[name].state.abilities, canon.abilities, name);
      assert.equal(state.npcs[name].state.canonicalCareer.path, canon.npcPath, name);
      assert.deepEqual(state.npcs[name].state.specializations, [canon.npcSpec], name);
    }
  }
});
