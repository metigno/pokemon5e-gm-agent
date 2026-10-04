import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import {
  calculateMoveStats,
  scaledHp
} from "../src/combat/poke5e-rules.mjs";
import { typeMultiplier } from "../src/combat/type-chart.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-04T10:20:00.000Z";

test("local combat pack is pinned to the selected Poke5e 2024 upstream ref", async () => {
  const data = new Poke5eDataRepository();
  const meta = await data.metadata();
  assert.equal(meta.repository, "Auroratide/poke5e");
  assert.equal(meta.ref, "b411a993eba07f36218f8ea70dd2c402e2e7c91a");
  assert.equal(meta.version, "v1.12.15");
});

test("Pokémon HP is scaled with the upstream dynamic-level formula", async () => {
  const data = new Poke5eDataRepository();
  const growlithe = await data.getSpecies({ species: "Growlithe", form: "Hisuian" });
  const houndour = await data.getSpecies({ species: "Houndour" });

  assert.equal(scaledHp(growlithe, 5), 37);
  assert.equal(scaledHp(houndour, 3), 27);
});

test("2024 move math uses proficiency for STAB and level damage tiers", async () => {
  const data = new Poke5eDataRepository();
  const species = await data.getSpecies({ species: "Growlithe", form: "Hisuian" });
  const ember = await data.getMove("ember");
  const combatant = {
    level: 5,
    types: species.type,
    attributes: species.attributes
  };

  const stats = calculateMoveStats(combatant, ember);
  assert.equal(stats.moveModifier, 1);
  assert.equal(stats.proficiencyBonus, 3);
  assert.equal(stats.toHit, 4);
  assert.equal(stats.stab, 3);
  assert.equal(stats.damageDice, "1d12");
  assert.equal(stats.damageModifier, 4);
});

test("type math follows Pokemon 5e single vulnerability/resistance semantics", () => {
  assert.equal(typeMultiplier("water", ["dark", "fire"]), 2);
  assert.equal(typeMultiplier("fire", ["fire", "rock"]), 0.5);
  assert.equal(typeMultiplier("ghost", ["normal"]), 0);
  assert.equal(typeMultiplier("bug", ["grass", "dark"]), 2);
  assert.equal(typeMultiplier("fire", ["grass", "water"]), 1);
});

test("all five player starters can enter the offline combat core", async () => {
  const descriptors = [
    { species: "Growlithe", form: "Hisuian", level: 5 },
    { species: "Eevee", form: "Standard", level: 5 },
    { species: "Gastly", form: "Standard", level: 5 },
    { species: "Totodile", form: "Standard", level: 5 },
    { species: "Koffing", form: "Standard", level: 5 }
  ];

  for (const descriptor of descriptors) {
    const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 10]) });
    const fighter = await combat.createCombatant(descriptor);
    assert.ok(fighter.hp.max > 0, descriptor.species);
    assert.ok(fighter.moveIds.length >= 1, descriptor.species);
  }
});

test("opponent initiative, attack, STAB and resistance resolve locally", async () => {
  const dice = new SequenceDice([
    1, 20,
    15, 6
  ]);
  const combat = new Pokemon5eCombatEngine({ dice });
  const battle0 = await combat.createBattle({
    encounterId: "HOUNDOUR_GINESTRE_001",
    playerPokemon: { species: "Growlithe", form: "Hisuian", level: 5 },
    opponent: { species: "Houndour", level: 3 }
  });

  assert.equal(combat.actor(battle0), "opponent");

  const battle1 = await combat.advanceToPlayerOrEnd(battle0);
  const attack = battle1.log.find((entry) => entry.type === "attack");

  assert.equal(attack.moveId, "ember");
  assert.equal(attack.attackTotal, 19);
  assert.equal(attack.stab, 2);
  assert.equal(attack.rawDamage, 10);
  assert.equal(attack.typeMultiplier, 0.5);
  assert.equal(attack.damage, 5);
  assert.equal(battle1.player.hp.current, 32);
  assert.equal(combat.actor(battle1), "player");
});

test("a local combat win returns to the authored narrative node", async () => {
  const dice = new SequenceDice([
    15, 5,
    15, 6
  ]);
  const combat = new Pokemon5eCombatEngine({ dice });
  const book = new BookgameEngine({ now: fixedNow });

  let state = createNewGameState({ protagonist: "Luke", now: fixedNow });
  state = await book.choose(state, "send_starter");

  let battle = await combat.createBattle(state.pending);
  battle.opponent.hp.current = 1;
  state = book.setCombatState(state, battle);

  battle = await combat.usePlayerMove(battle, "ember");
  assert.equal(battle.outcome, "win");
  assert.equal(battle.opponent.hp.current, 0);

  state = book.setCombatState(state, battle);
  state = book.resolveCombatHandoff(state, battle.outcome);

  assert.equal(state.pending, null);
  assert.equal(state.story.nodeId, "combat_win");
  assert.equal(state.story.history.at(-1).outcome, "win");
});

test("save -> close -> reload preserves exact mid-combat HP, PP, round and turn", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-combat-save-"));
  try {
    const store = new SaveStore(dir);
    const book = new BookgameEngine({ now: fixedNow });
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([15, 5])
    });

    let state = createNewGameState({ protagonist: "Luke", slot: "slot-combat", now: fixedNow });
    state = await book.choose(state, "send_starter");
    const battle = await combat.createBattle(state.pending);
    state = book.setCombatState(state, battle);
    await store.save(state);

    const loaded = await store.load("slot-combat");
    assert.deepEqual(loaded, state);
    assert.equal(loaded.pending.status, "in_progress");
    assert.equal(loaded.pending.battle.player.hp.current, 37);
    assert.equal(loaded.pending.battle.opponent.hp.current, 27);
    assert.equal(loaded.pending.battle.round, 1);
    assert.equal(loaded.pending.battle.order[loaded.pending.battle.turnIndex], "player");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
