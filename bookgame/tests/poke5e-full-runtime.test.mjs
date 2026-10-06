import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Pokemon5eCombatEngine, isMoveResolvable } from "../src/combat/combat-engine.mjs";
import { applyItemToPokemon, compileItemRule } from "../src/combat/item-rules.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";
import {
  calculateMoveStats,
  damageProfile,
  damageRollHasAdvantage,
  resolveAttack
} from "../src/combat/poke5e-rules.mjs";
import {
  applyStatus,
  createStatusState,
  endTurnStatus,
  startTurnStatus
} from "../src/combat/status.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const WORLD_DISTRIBUTION = new URL(
  "../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",
  import.meta.url
);
const WORLD_POOLS = new URL(
  "../../campaign/world/ecology/ZONE_POOLS.json",
  import.meta.url
);

function collectPoolSpecies(value, into = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /^[a-z0-9][a-z0-9-]*$/.test(item)) into.add(item);
      else collectPoolSpecies(item, into);
    }
    return into;
  }
  if (value && typeof value === "object") {
    if (typeof value.species_id === "string") into.add(value.species_id);
    if (typeof value.speciesId === "string") into.add(value.speciesId);
    for (const nested of Object.values(value)) collectPoolSpecies(nested, into);
  }
  return into;
}

function dummyPokemon({ types = ["normal"], level = 5 } = {}) {
  return {
    types,
    level,
    abilityId: null,
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    hp: { current: 30, max: 30 },
    statuses: createStatusState()
  };
}

test("complete offline Pokémon 5e pack is pinned and count-locked", async () => {
  const data = new Poke5eDataRepository();
  const meta = await data.metadata();

  assert.equal(meta.repository, "Auroratide/poke5e");
  assert.equal(meta.ref, "b411a993eba07f36218f8ea70dd2c402e2e7c91a");
  assert.equal(meta.version, "v1.12.15");
  assert.equal(meta.policy, "complete_offline_bookgame_runtime_pack");
  assert.deepEqual(meta.counts, {
    species: 1151,
    moves: 830,
    abilities: 340,
    items: 305,
    evolutions: 538,
    tms: 256,
    conditions: 8
  });
});

test("every species in canonical world distribution exists in the offline runtime", async () => {
  const data = new Poke5eDataRepository();
  const world = JSON.parse(await readFile(WORLD_DISTRIBUTION, "utf8"));
  const available = new Set((await data.listSpecies()).map((species) => species.id));

  assert.equal(world.species.length, 1139);
  const missing = world.species.map((entry) => entry.id).filter((id) => !available.has(id));
  assert.deepEqual(missing, []);
});

test("every species exposed by canonical zone pools exists in the offline runtime", async () => {
  const data = new Poke5eDataRepository();
  const pools = JSON.parse(await readFile(WORLD_POOLS, "utf8"));
  const poolSpecies = collectPoolSpecies(pools);
  const available = new Set((await data.listSpecies()).map((species) => species.id));
  const missing = [...poolSpecies].filter((id) => !available.has(id));

  assert.ok(poolSpecies.size > 900);
  assert.deepEqual(missing, []);
});

test("move execution coverage has an explicit non-regression gate", async () => {
  const data = new Poke5eDataRepository();
  const moves = await data.listMoves();
  const unresolved = moves.filter((move) => !isMoveResolvable(move)).map((move) => move.id);

  assert.ok(unresolved.length <= 200, `unresolved move rules regressed to ${unresolved.length}`);
  assert.ok(unresolved.includes("acupressure"));
  for (const id of [
    "agility",
    "autotomize",
    "barrier",
    "bulk-up",
    "coil",
    "cotton-guard",
    "defend-order",
    "dragon-dance",
    "hone-claws",
    "minimize",
    "quiver-dance",
    "rock-polish",
    "shell-smash",
    "shift-gear",
    "aromatherapy",
    "heal-bell",
    "charm",
    "fake-tears",
    "metal-sound",
    "screech",
    "tearful-look",
    "moonlight",
    "morning-sun",
    "rest",
    "ingrain",
    "lunar-blessing",
    "wish",
    "stockpile",
    "swallow",
    "heal-pulse",
    "recover"
  ]) {
    assert.ok(!unresolved.includes(id), `${id} should be executable`);
  }
});

test("common self-buff moves execute level scaling, AC, damage, speed and concentration rules", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 19, 4, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_BULK_UP",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["bulk-up", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  battle = await combat.usePlayerMove(battle, "bulk-up");
  assert.equal(battle.player.concentration?.moveId, "bulk-up");
  assert.equal(battle.player.effects.acModifierSources.at(-1).value, 2);
  assert.equal(battle.player.effects.damageModifierSources.at(-1).value, 2);

  const baseAc = battle.player.ac;
  battle = await combat.endPlayerTurn(battle);
  battle = await combat.useOpponentTurn(battle);

  const incomingAttack = [...battle.log].reverse().find((event) => event.type === "attack");
  assert.equal(incomingAttack.defenderAc, baseAc + 2);
  assert.equal(battle.player.concentration, null);
  assert.equal(battle.player.effects.acModifierSources.length, 0);
  assert.ok(
    battle.log.some(
      (event) => event.type === "concentration_end" && event.reason === "failed_damage_save"
    )
  );

  const speedCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let speedBattle = await speedCombat.createBattle({
    encounterId: "FULL_RUNTIME_AGILITY",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["agility", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  const baseMovement = speedBattle.player.turn.movementRemaining;
  speedBattle = await speedCombat.usePlayerMove(speedBattle, "agility");
  assert.equal(speedBattle.player.effects.speedModifierSources.at(-1).value, 20);
  assert.equal(speedBattle.player.turn.movementRemaining, baseMovement + 20);
});



test("extended self-buffs execute proficiency scaling and self-area targeting", async () => {
  const shellCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let shellBattle = await shellCombat.createBattle({
    encounterId: "FULL_RUNTIME_SHELL_SMASH",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["shell-smash"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 50, y: 0 }
  });
  shellBattle = await shellCombat.usePlayerMove(shellBattle, "shell-smash");
  assert.equal(shellBattle.player.effects.acModifierSources.at(-1).value, -1);
  assert.equal(shellBattle.player.effects.damageModifierSources.at(-1).value, 3);

  const barrierCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let barrierBattle = await barrierCombat.createBattle({
    encounterId: "FULL_RUNTIME_BARRIER_SELF_AREA",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["barrier"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 50, y: 0 }
  });
  barrierBattle = await barrierCombat.usePlayerMove(barrierBattle, "barrier");
  assert.equal(barrierBattle.player.effects.acModifierSources.at(-1).value, 2);
  assert.equal(barrierBattle.player.concentration?.moveId, "barrier");
});

test("save debuffs and allied status cures execute their 2024 effects", async () => {
  const debuffCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1])
  });
  let debuffBattle = await debuffCombat.createBattle({
    encounterId: "FULL_RUNTIME_CHARM",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["charm"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  debuffBattle = await debuffCombat.usePlayerMove(debuffBattle, "charm");
  assert.equal(debuffBattle.opponent.effects.attackModifierSources.at(-1).source, "charm");
  assert.equal(debuffBattle.opponent.effects.attackModifierSources.at(-1).value, -3);

  const cureCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let cureBattle = await cureCombat.createBattle({
    encounterId: "FULL_RUNTIME_AROMATHERAPY",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["aromatherapy"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 50, y: 0 }
  });
  applyStatus(cureBattle.player, "Poisoned");
  cureBattle = await cureCombat.usePlayerMove(cureBattle, "aromatherapy");
  assert.equal(cureBattle.player.statuses.nonVolatile, null);
  assert.deepEqual(
    cureBattle.log.find((event) => event.type === "status_cure_move").curedStatuses,
    ["Poisoned"]
  );
});

test("regional-form lookup resolves real upstream species ids", async () => {
  const data = new Poke5eDataRepository();

  assert.equal((await data.getSpecies({ species: "Growlithe", form: "Hisuian" })).id, "growlithe-hisui");
  assert.equal((await data.getSpecies({ species: "Rattata", form: "Alolan" })).id, "alolan-rattata");
  assert.equal((await data.getSpecies({ species: "Slowpoke", form: "Galarian" })).id, "galarian-slowpoke");
  assert.equal((await data.getSpecies({ species: "Wooper", form: "Paldean" })).id, "wooper-paldea");
});

test("all upstream species can instantiate at their real minimum level without an ability whitelist", async () => {
  const data = new Poke5eDataRepository();
  const combat = new Pokemon5eCombatEngine({ data, dice: new SequenceDice([10]) });
  const species = await data.listSpecies();

  for (const entry of species) {
    const fighter = await combat.createCombatant({ speciesId: entry.id, level: entry.minLevel });
    assert.equal(fighter.speciesId, entry.id);
    assert.ok(fighter.hp.max > 0, entry.id);
    assert.ok(fighter.moveIds.length <= 4, entry.id);
    if (fighter.abilityId) assert.ok(fighter.ability?.description, entry.id);
  }
});

test("Struggle guarantees an executable combat action even for a start pool containing only utility moves", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10, 9]) });
  const battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_MAGIKARP",
    playerPokemon: { speciesId: "magikarp", level: 1 },
    opponent: { speciesId: "caterpie", level: 1 },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  const moves = await combat.legalMoves(battle, "player");
  assert.ok(moves.some((move) => move.id === "struggle"));
});

test("healing moves respect real target rules instead of always healing the user", async () => {
  const selfCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 4, 4])
  });
  let selfBattle = await selfCombat.createBattle({
    encounterId: "FULL_RUNTIME_RECOVER_TARGET",
    playerPokemon: { speciesId: "chansey", level: 5, moveIds: ["recover"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  selfBattle.player.hp.current = Math.max(1, selfBattle.player.hp.max - 12);
  const opponentBefore = selfBattle.opponent.hp.current;
  const playerBefore = selfBattle.player.hp.current;

  selfBattle = await selfCombat.usePlayerMove(selfBattle, "recover", { targetSide: "player" });
  assert.ok(selfBattle.player.hp.current > playerBefore);
  assert.equal(selfBattle.opponent.hp.current, opponentBefore);
  assert.equal(selfBattle.log.at(-1).type, "healing_move");
  assert.equal(selfBattle.log.at(-1).target, "player");

  const pulseCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 4, 4])
  });
  let pulseBattle = await pulseCombat.createBattle({
    encounterId: "FULL_RUNTIME_HEAL_PULSE_TARGET",
    playerPokemon: { speciesId: "chansey", level: 5, moveIds: ["heal-pulse"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  pulseBattle.opponent.hp.current = Math.max(1, pulseBattle.opponent.hp.max - 8);
  const targetBefore = pulseBattle.opponent.hp.current;

  await assert.rejects(
    () => pulseCombat.usePlayerMove(pulseBattle, "heal-pulse", { targetSide: "player" }),
    /cannot target its user/
  );

  pulseBattle = await pulseCombat.usePlayerMove(pulseBattle, "heal-pulse", { targetSide: "opponent" });
  assert.ok(pulseBattle.opponent.hp.current > targetBefore);
  assert.equal(pulseBattle.log.at(-1).type, "healing_move");
  assert.equal(pulseBattle.log.at(-1).target, "opponent");
});


test("Moonlight, Morning Sun and Rest execute environmental and delayed healing rules", async () => {
  const moonCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 4, 4, 4])
  });
  let moonBattle = await moonCombat.createBattle({
    encounterId: "FULL_RUNTIME_MOONLIGHT_DAY",
    environment: { timeOfDay: "day" },
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["moonlight"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  moonBattle.player.hp.current = Math.max(1, moonBattle.player.hp.max - 30);
  moonBattle = await moonCombat.usePlayerMove(moonBattle, "moonlight");
  const moonLog = moonBattle.log.find((event) => event.type === "healing_move");
  assert.equal(moonLog.environmentalMultiplier, 0.5);
  assert.ok(moonLog.healing > 0);

  const restCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1, 1, 1, 1, 1, 1])
  });
  let restBattle = await restCombat.createBattle({
    encounterId: "FULL_RUNTIME_REST",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["rest"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  restBattle.player.hp.current = Math.max(1, restBattle.player.hp.max - 20);
  const hpBefore = restBattle.player.hp.current;
  restBattle = await restCombat.usePlayerMove(restBattle, "rest");
  assert.equal(restBattle.player.statuses.nonVolatile, null);
  assert.equal(restBattle.pendingEffects.at(-1).kind, "rest");

  restBattle = await restCombat.endPlayerTurn(restBattle);
  assert.equal(restBattle.player.statuses.nonVolatile, "Asleep");
  assert.ok(restBattle.player.hp.current > hpBefore);
  assert.equal(restBattle.pendingEffects.length, 0);
});


test("Ingrain, Lunar Blessing and Wish execute persistent healing state", async () => {
  const ingrainCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 4, 20])
  });
  let ingrainBattle = await ingrainCombat.createBattle({
    encounterId: "FULL_RUNTIME_INGRAIN",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["ingrain"] },
    playerBench: [{ speciesId: "pikachu", level: 5, moveIds: ["tackle"] }],
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  ingrainBattle.player.hp.current = Math.max(1, ingrainBattle.player.hp.max - 20);
  const ingrainHp = ingrainBattle.player.hp.current;
  ingrainBattle = await ingrainCombat.usePlayerMove(ingrainBattle, "ingrain");
  assert.ok(ingrainBattle.player.hp.current > ingrainHp);
  assert.equal(
    ingrainBattle.player.effects.ongoingEffects.find((effect) => effect.kind === "ingrain").remainingEndTurns,
    2
  );
  ingrainBattle = await ingrainCombat.advanceToPlayerOrEnd(ingrainBattle);
  assert.equal(ingrainBattle.player.turn.movementRemaining, 0);
  await assert.rejects(
    () => ingrainCombat.switchPlayer(ingrainBattle, 0),
    /Ingrain prevents voluntary switching/
  );

  const lunarCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 4])
  });
  let lunarBattle = await lunarCombat.createBattle({
    encounterId: "FULL_RUNTIME_LUNAR_BLESSING",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["lunar-blessing"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  lunarBattle.player.hp.current = Math.max(1, lunarBattle.player.hp.max - 20);
  const lunarHp = lunarBattle.player.hp.current;
  lunarBattle = await lunarCombat.usePlayerMove(lunarBattle, "lunar-blessing");
  lunarBattle = await lunarCombat.endPlayerTurn(lunarBattle);
  lunarBattle = await lunarCombat.advanceToPlayerOrEnd(lunarBattle);
  assert.ok(lunarBattle.player.hp.current > lunarHp);
  assert.equal(lunarBattle.player.concentration?.moveId, "lunar-blessing");

  const wishCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 10, 4, 1, 1, 1, 1, 1])
  });
  let wishBattle = await wishCombat.createBattle({
    encounterId: "FULL_RUNTIME_WISH",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["wish"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  wishBattle.player.hp.current = Math.max(1, wishBattle.player.hp.max - 20);
  wishBattle = await wishCombat.usePlayerMove(wishBattle, "wish", { targetSide: "player" });
  assert.equal(wishBattle.pendingEffects.at(-1).kind, "wish");
  wishBattle = await wishCombat.endPlayerTurn(wishBattle);
  wishBattle = await wishCombat.advanceToPlayerOrEnd(wishBattle);
  const wishBefore = wishBattle.player.hp.current;
  wishBattle = await wishCombat.endPlayerTurn(wishBattle);
  assert.ok(wishBattle.player.hp.current > wishBefore);
  assert.equal(wishBattle.pendingEffects.length, 0);
});


test("Stockpile powers and is consumed by Swallow and Spit Up", async () => {
  const swallowCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 6])
  });
  let swallowBattle = await swallowCombat.createBattle({
    encounterId: "FULL_RUNTIME_STOCKPILE_SWALLOW",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["stockpile", "swallow"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  swallowBattle.player.hp.current = Math.max(1, swallowBattle.player.hp.max - 20);
  swallowBattle = await swallowCombat.usePlayerMove(swallowBattle, "stockpile");
  assert.equal(swallowBattle.player.effects.stockpileCount, 1);
  assert.equal(swallowBattle.player.effects.acModifierSources.at(-1).value, 1);
  swallowBattle = await swallowCombat.endPlayerTurn(swallowBattle);
  swallowBattle = await swallowCombat.advanceToPlayerOrEnd(swallowBattle);
  const hpBefore = swallowBattle.player.hp.current;
  swallowBattle = await swallowCombat.usePlayerMove(swallowBattle, "swallow");
  assert.ok(swallowBattle.player.hp.current > hpBefore);
  assert.equal(swallowBattle.player.effects.stockpileCount, 0);
  assert.equal(
    swallowBattle.player.effects.acModifierSources.some((entry) => entry.source === "stockpile"),
    false
  );

  const spitCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 20, 15, 4, 4])
  });
  let spitBattle = await spitCombat.createBattle({
    encounterId: "FULL_RUNTIME_STOCKPILE_SPIT_UP",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["stockpile", "spit-up"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  spitBattle = await spitCombat.usePlayerMove(spitBattle, "stockpile");
  spitBattle = await spitCombat.endPlayerTurn(spitBattle);
  spitBattle = await spitCombat.advanceToPlayerOrEnd(spitBattle);
  spitBattle = await spitCombat.usePlayerMove(spitBattle, "stockpile");
  assert.equal(spitBattle.player.effects.stockpileCount, 2);
  spitBattle = await spitCombat.endPlayerTurn(spitBattle);
  spitBattle = await spitCombat.advanceToPlayerOrEnd(spitBattle);
  spitBattle = await spitCombat.usePlayerMove(spitBattle, "spit-up");
  const attack = [...spitBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(attack.damageDiceMultiplier, 2);
  assert.equal(attack.damageRoll.selected.rolls.length, 2);
  assert.equal(spitBattle.player.effects.stockpileCount, 0);
});

test("canonical OHKO moves execute their d20, level and immunity rules", async () => {
  const hornCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20])
  });
  let hornBattle = await hornCombat.createBattle({
    encounterId: "FULL_RUNTIME_HORN_DRILL",
    playerPokemon: { speciesId: "rhydon", level: 10, moveIds: ["horn-drill"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  hornBattle = await hornCombat.usePlayerMove(hornBattle, "horn-drill");
  assert.equal(hornBattle.outcome, "win");
  assert.equal(hornBattle.log.find((event) => event.type === "ohko_move").success, true);

  const levelCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20])
  });
  let levelBattle = await levelCombat.createBattle({
    encounterId: "FULL_RUNTIME_SHEER_COLD_LEVEL",
    playerPokemon: { speciesId: "snover", level: 5, moveIds: ["sheer-cold"] },
    opponent: { speciesId: "caterpie", level: 15, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  const levelHp = levelBattle.opponent.hp.current;
  levelBattle = await levelCombat.usePlayerMove(levelBattle, "sheer-cold");
  const levelEvent = levelBattle.log.find((event) => event.type === "ohko_move");
  assert.equal(levelEvent.natural, 20);
  assert.equal(levelEvent.levelBlocked, true);
  assert.equal(levelBattle.opponent.hp.current, levelHp);

  const fissureCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20])
  });
  let fissureBattle = await fissureCombat.createBattle({
    encounterId: "FULL_RUNTIME_FISSURE_FLYING",
    playerPokemon: { speciesId: "diglett", level: 5, moveIds: ["fissure"] },
    opponent: { speciesId: "pidgey", level: 5, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  const fissureHp = fissureBattle.opponent.hp.current;
  fissureBattle = await fissureCombat.usePlayerMove(fissureBattle, "fissure");
  const fissureEvent = fissureBattle.log.find((event) => event.type === "ohko_move");
  assert.equal(fissureEvent.fissureBlocked, true);
  assert.equal(fissureBattle.opponent.hp.current, fissureHp);
});

test("save-based HP moves execute Endeavor, Nature's Madness, Pain Split and Ruination", async () => {
  const makeBattle = async (moveId) => {
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([20, 1, 1])
    });
    const battle = await combat.createBattle({
      encounterId: `FULL_RUNTIME_HP_${moveId}`,
      playerPokemon: { speciesId: "eevee", level: 5, moveIds: [moveId] },
      opponent: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
      playerPosition: { x: 0, y: 0 },
      opponentPosition: { x: 5, y: 0 }
    });
    return { combat, battle };
  };

  {
    const { combat, battle } = await makeBattle("endeavor");
    battle.player.hp.current = 4;
    battle.opponent.hp.current = 20;

    const roundOneMoves = await combat.availablePlayerMoves(battle);
    assert.equal(roundOneMoves.some((move) => move.id === "endeavor"), false);
    await assert.rejects(
      () => combat.usePlayerMove(battle, "endeavor"),
      /cannot be used in the first round/
    );

    battle.round = 2;
    const next = await combat.usePlayerMove(battle, "endeavor");
    assert.equal(next.opponent.hp.current, 4);
    assert.equal(next.log.find((event) => event.type === "save_hp_effect").hpLoss, 16);
  }

  {
    const { combat, battle } = await makeBattle("natures-madness");
    battle.opponent.hp.current = 19;
    const next = await combat.usePlayerMove(battle, "natures-madness");
    assert.equal(next.opponent.hp.current, 10);
    assert.equal(next.log.find((event) => event.type === "save_hp_effect").hpLoss, 9);
  }

  {
    const { combat, battle } = await makeBattle("pain-split");
    battle.player.hp.current = 6;
    battle.opponent.hp.current = 20;
    const next = await combat.usePlayerMove(battle, "pain-split");
    assert.equal(next.player.hp.current, 13);
    assert.equal(next.opponent.hp.current, 13);
  }

  {
    const { combat, battle } = await makeBattle("ruination");
    battle.opponent.hp.current = 20;
    const maxBefore = battle.opponent.hp.max;
    const next = await combat.usePlayerMove(battle, "ruination");
    assert.equal(next.opponent.hp.current, 10);
    assert.equal(next.opponent.hp.max, maxBefore - 10);
    assert.equal(next.log.find((event) => event.type === "save_hp_effect").hpLoss, 10);
  }
});

test("Refresh and Purify execute status cures with Purify healing only on a real cure", async () => {
  {
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([20, 1])
    });
    let battle = await combat.createBattle({
      encounterId: "FULL_RUNTIME_REFRESH",
      playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["refresh"] },
      opponent: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
      playerPosition: { x: 0, y: 0 },
      opponentPosition: { x: 5, y: 0 }
    });
    applyStatus(battle.player, "Burned");
    battle = await combat.usePlayerMove(battle, "refresh");
    assert.equal(battle.player.statuses.nonVolatile, null);
    assert.deepEqual(
      battle.log.find((event) => event.type === "status_cure_move").curedStatuses,
      ["Burned"]
    );
  }

  {
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([20, 1])
    });
    let battle = await combat.createBattle({
      encounterId: "FULL_RUNTIME_PURIFY",
      playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["purify"] },
      opponent: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
      playerPosition: { x: 0, y: 0 },
      opponentPosition: { x: 5, y: 0 }
    });
    applyStatus(battle.opponent, "Poisoned");
    applyStatus(battle.opponent, "Confused");
    battle.player.hp.current = Math.max(1, battle.player.hp.max - 15);
    const hpBefore = battle.player.hp.current;

    battle = await combat.usePlayerMove(battle, "purify");
    assert.equal(battle.opponent.statuses.nonVolatile, null);
    assert.equal(battle.opponent.statuses.confusedRounds, 0);
    assert.equal(battle.player.hp.current, Math.min(battle.player.hp.max, hpBefore + 10));

    const event = battle.log.find((entry) => entry.type === "status_cure_move");
    assert.deepEqual(event.curedStatuses.sort(), ["Confused", "Poisoned"]);
    assert.equal(event.healing, 10);
  }
});

test("common passive abilities execute low-HP STAB, critical armor, status immunity and Pressure", async () => {
  const data = new Poke5eDataRepository();

  {
    const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10]) });
    const bulbasaur = await combat.createCombatant({
      speciesId: "bulbasaur",
      level: 5,
      abilityId: "overgrow",
      moveIds: ["vine-whip"]
    });
    bulbasaur.hp.current = Math.floor(bulbasaur.hp.max * 0.25);
    const stats = calculateMoveStats(bulbasaur, await data.getMove("vine-whip"));
    assert.equal(stats.stab, 6);
  }

  {
    const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10]) });
    const attacker = await combat.createCombatant({
      speciesId: "eevee",
      level: 5,
      moveIds: ["tackle"]
    });
    const defender = await combat.createCombatant({
      speciesId: "shellder",
      level: 5,
      abilityId: "shell-armor",
      moveIds: ["tackle"]
    });
    const result = resolveAttack({
      attacker,
      defender,
      move: await data.getMove("tackle"),
      dice: new SequenceDice([20, 6])
    });
    assert.equal(result.critical, true);
    assert.equal(result.criticalDamage, false);
    assert.equal(result.damageRoll.selected.expression, "1d12");
  }

  {
    const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10]) });
    const attacker = await combat.createCombatant({
      speciesId: "eevee",
      level: 5,
      abilityId: "adaptability",
      moveIds: ["tackle"]
    });
    const defender = await combat.createCombatant({
      speciesId: "eevee",
      level: 5,
      moveIds: ["tackle"]
    });
    const tackle = await data.getMove("tackle");

    assert.equal(damageRollHasAdvantage(attacker, tackle), true);
    let result = resolveAttack({
      attacker,
      defender,
      move: tackle,
      dice: new SequenceDice([15, 2, 10])
    });
    assert.equal(result.damageRoll.mode, "advantage");
    assert.equal(result.damageRoll.selected.total, 10);

    attacker.abilityId = "technician";
    assert.equal(damageRollHasAdvantage(attacker, tackle), true);

    attacker.abilityId = "adaptability";
    applyStatus(attacker, "Burned");
    result = resolveAttack({
      attacker,
      defender,
      move: tackle,
      dice: new SequenceDice([15, 5])
    });
    assert.equal(result.damageRoll.mode, "normal");
  }

  for (const [abilityId, status] of [
    ["insomnia", "Asleep"],
    ["comatose", "Asleep"],
    ["own-tempo", "Confused"],
    ["inner-focus", "Flinched"],
    ["limber", "Paralysis"],
    ["immunity", "Poisoned"],
    ["heatproof", "Burned"],
    ["water-veil", "Burned"],
    ["magma-armor", "Frozen"],
    ["purifying-salt", "BadlyPoisoned"]
  ]) {
    const target = dummyPokemon();
    target.abilityId = abilityId;
    const result = applyStatus(target, status);
    assert.equal(result.applied, false, `${abilityId} should block ${status}`);
    assert.match(result.reason, /^ability:/);
  }

  {
    const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10]) });
    const attacker = await combat.createCombatant({
      speciesId: "eevee",
      level: 5,
      moveIds: ["tackle"]
    });
    const defender = await combat.createCombatant({
      speciesId: "eevee",
      level: 5,
      moveIds: ["tackle"]
    });
    attacker.abilityId = "guts";
    applyStatus(attacker, "Burned");

    const result = resolveAttack({
      attacker,
      defender,
      move: await data.getMove("tackle"),
      dice: new SequenceDice([15, 5])
    });
    assert.equal(result.attackRoll.mode, "normal");
    assert.equal(result.damageRoll.mode, "normal");
    assert.equal(result.gutsBonus, 2);
    assert.equal(result.attackModifier, 6);
    assert.equal(result.damageModifier, 6);
  }

  {
    const target = dummyPokemon();
    target.types = ["normal"];

    target.abilityId = "thick-fat";
    assert.equal(damageProfile({ type: "fire" }, target).multiplier, 0.5);
    assert.equal(damageProfile({ type: "ice" }, target).multiplier, 0.5);

    target.abilityId = "heatproof";
    assert.equal(damageProfile({ type: "fire" }, target).multiplier, 0.5);

    target.abilityId = "purifying-salt";
    assert.equal(damageProfile({ type: "ghost" }, target).multiplier, 0.5);

    target.abilityId = "aura-guard";
    assert.equal(
      damageProfile({ type: "normal", range: { type: "melee" } }, target).multiplier,
      0.5
    );

    target.abilityId = "fluffy";
    assert.equal(damageProfile({ type: "fire", range: { type: "distance" } }, target).multiplier, 2);
    assert.equal(damageProfile({ type: "normal", range: { type: "melee" } }, target).multiplier, 0.5);
  }

  {
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([20, 1, 15, 6])
    });
    let battle = await combat.createBattle({
      encounterId: "FULL_RUNTIME_PRESSURE",
      playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["tackle"] },
      opponent: {
        speciesId: "dusclops",
        level: 10,
        abilityId: "pressure",
        moveIds: ["tackle"]
      },
      playerPosition: { x: 0, y: 0 },
      opponentPosition: { x: 5, y: 0 }
    });
    const ppBefore = battle.player.pp.tackle;
    battle = await combat.usePlayerMove(battle, "tackle");
    assert.equal(battle.player.pp.tackle, ppBefore - 2);
    assert.ok(
      battle.log.some(
        (event) =>
          event.type === "ability_trigger" &&
          event.abilityId === "pressure" &&
          event.ppCost === 2
      )
    );
  }
});

test("2024 status core supports Frozen, Badly Poisoned and Confused", () => {
  const frozen = dummyPokemon({ types: ["water"] });
  assert.equal(applyStatus(frozen, "Frozen", { sourceProficiencyBonus: 3 }).applied, true);
  const frozenTurn = startTurnStatus(frozen, new SequenceDice([10]));
  assert.equal(frozenTurn.skipTurn, true);
  assert.equal(frozenTurn.reason, "Frozen");

  const badlyPoisoned = dummyPokemon();
  applyStatus(badlyPoisoned, "BadlyPoisoned");
  const poisonEvents = endTurnStatus(badlyPoisoned, new SequenceDice([10]), 3);
  assert.equal(poisonEvents.find((event) => event.type === "status_damage").damage, 6);

  const confused = dummyPokemon();
  applyStatus(confused, "Confused");
  const confusedTurn = startTurnStatus(confused, new SequenceDice([1]));
  assert.equal(confusedTurn.forcedAction, "STRUGGLE_SELF");
});

test("2024 type immunities block the matching non-volatile statuses", () => {
  assert.equal(applyStatus(dummyPokemon({ types: ["fire"] }), "Burned").applied, false);
  assert.equal(applyStatus(dummyPokemon({ types: ["ice"] }), "Frozen").applied, false);
  assert.equal(applyStatus(dummyPokemon({ types: ["electric"] }), "Paralysis").applied, false);
  assert.equal(applyStatus(dummyPokemon({ types: ["steel"] }), "BadlyPoisoned").applied, false);
});

test("offline item runtime executes potion, antidote, Full Heal and Ether rules", async () => {
  const data = new Poke5eDataRepository();
  const target = dummyPokemon();
  target.hp.current = 10;
  target.moveIds = ["tackle"];
  target.pp = { tackle: 1 };
  target.maxPp = { tackle: 10 };

  const potion = await data.getItem("potion");
  const potionResult = applyItemToPokemon({
    item: potion,
    target,
    dice: new SequenceDice([4, 4])
  });
  assert.equal(potionResult.applied, true);
  assert.equal(target.hp.current, 20);

  applyStatus(target, "Poisoned");
  const antidote = await data.getItem("antidote");
  assert.equal(applyItemToPokemon({ item: antidote, target, dice: new SequenceDice([1]) }).applied, true);
  assert.equal(target.statuses.nonVolatile, null);

  applyStatus(target, "Confused");
  applyStatus(target, "Burned");
  const fullHeal = await data.getItem("full-heal");
  applyItemToPokemon({ item: fullHeal, target, dice: new SequenceDice([1]) });
  assert.equal(target.statuses.nonVolatile, null);
  assert.equal(target.statuses.confusedRounds, 0);

  const ether = await data.getItem("ether");
  applyItemToPokemon({ item: ether, target, dice: new SequenceDice([1]), moveId: "tackle" });
  assert.equal(target.pp.tackle, 6);

  assert.equal(compileItemRule(await data.getItem("max-potion")).delayed, true);
});

test("representative long-tail data resolves locally without network access", async () => {
  const data = new Poke5eDataRepository();

  assert.equal((await data.getMove("flamethrower")).save.attribute, "dex");
  assert.equal((await data.getMove("thunder-wave")).save.attribute, "con");
  assert.equal((await data.getAbility("static")).name, "Static");
  assert.equal((await data.getAbility("neutralizing-gas")).name, "Neutralizing Gas");
  assert.equal((await data.getItem("poke-ball")).type, "pokeball");
  assert.equal((await data.getCondition("Badly Poisoned")).id, "BadlyPoisoned");
  assert.ok((await data.listEvolutions()).length >= 500);
});

test("persisted known moves are capped at four and survive as the exact combat moveset", async () => {
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([10]) });
  const fighter = await combat.createCombatant({
    speciesId: "pikachu",
    level: 10,
    moveIds: ["thunder-shock", "quick-attack", "thunder-wave", "electro-ball"]
  });

  assert.deepEqual(fighter.moveIds, [
    "thunder-shock",
    "quick-attack",
    "thunder-wave",
    "electro-ball"
  ]);

  await assert.rejects(
    () => combat.createCombatant({
      speciesId: "pikachu",
      level: 10,
      moveIds: ["tail-whip", "thunder-shock", "play-nice", "growl", "quick-attack"]
    }),
    /at most 4 known moves/
  );
});

test("all 256 TM references resolve to real offline moves", async () => {
  const data = new Poke5eDataRepository();
  const tms = await data.listTms();
  assert.equal(tms.length, 256);

  for (const tm of tms) {
    const move = await data.getMove(tm.move);
    assert.equal(move.id, tm.move);
  }
});
