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
  resolveAttack,
  resolveSavingThrow
} from "../src/combat/poke5e-rules.mjs";
import {
  applyStatus,
  createStatusState,
  endTurnStatus,
  startTurnStatus
} from "../src/combat/status.mjs";
import { movementSpeed } from "../src/combat/spatial.mjs";
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

  assert.ok(unresolved.length <= 166, `unresolved move rules regressed to ${unresolved.length}`);
  for (const id of [
    "acupressure",
    "feather-dance",
    "lock-on",
    "mean-look",
    "rain-dance",
    "sunny-day",
    "agility",
    "autotomize",
    "barrier",
    "bulk-up",
    "calm-mind",
    "charge",
    "coil",
    "clangorous-soul",
    "cosmic-power",
    "cotton-guard",
    "defend-order",
    "defense-curl",
    "dragon-dance",
    "fillet-away",
    "focus-energy",
    "geomancy",
    "harden",
    "hone-claws",
    "iron-defense",
    "kinesis",
    "laser-focus",
    "magnet-rise",
    "mind-reader",
    "meditate",
    "minimize",
    "no-retreat",
    "quiver-dance",
    "rock-polish",
    "shell-smash",
    "shift-gear",
    "tail-glow",
    "victory-dance",
    "aqua-ring",
    "aromatherapy",
    "heal-bell",
    "healing-wish",
    "lunar-dance",
    "charm",
    "cotton-spore",
    "fake-tears",
    "metal-sound",
    "screech",
    "sweet-scent",
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

test("Acupressure follows its d6 table and temporary HP absorbs incoming damage", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 3, 19, 1, 1, 1, 1, 1, 1, 1, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_ACUPRESSURE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["acupressure"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  const hpBefore = battle.player.hp.current;
  battle = await combat.usePlayerMove(battle, "acupressure");
  assert.equal(battle.player.temporaryHp, 10);
  assert.equal(battle.player.effects.temporaryHpSource.source, "acupressure");

  battle = await combat.endPlayerTurn(battle);
  battle = await combat.useMove(battle, "opponent", "tackle");
  const attack = [...battle.log].reverse().find((event) => event.type === "attack");
  assert.ok(attack?.hit);
  assert.equal(
    hpBefore - battle.player.hp.current,
    Math.max(0, attack.damage - 10)
  );
  assert.equal(
    battle.player.temporaryHp,
    Math.max(0, 10 - attack.damage)
  );
});

test("Feather Dance, Mean Look and Lock-On execute their target rules", async () => {
  const featherCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1, 20, 1, 1])
  });
  let featherBattle = await featherCombat.createBattle({
    encounterId: "FULL_RUNTIME_FEATHER_DANCE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["feather-dance"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  featherBattle = await featherCombat.usePlayerMove(featherBattle, "feather-dance");
  const featherSource = featherBattle.opponent.effects.attackModifierSources
    .find((source) => source.source === "feather-dance");
  assert.equal(featherSource?.value, -2);
  assert.equal(featherBattle.player.concentration?.effectTargetSide, "opponent");

  featherBattle = await featherCombat.endPlayerTurn(featherBattle);
  featherBattle = await featherCombat.useOpponentTurn(featherBattle);
  assert.equal(featherBattle.player.concentration, null);
  assert.equal(
    featherBattle.opponent.effects.attackModifierSources
      .some((source) => source.source === "feather-dance"),
    false
  );

  const meanLookCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1])
  });
  let meanLookBattle = await meanLookCombat.createBattle({
    encounterId: "FULL_RUNTIME_MEAN_LOOK",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["mean-look"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["harden"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  meanLookBattle = await meanLookCombat.usePlayerMove(meanLookBattle, "mean-look");
  assert.equal(meanLookBattle.opponent.effects.switchLockSources.at(-1)?.source, "mean-look");
  assert.equal(meanLookBattle.opponent.effects.escapeLockSources.at(-1)?.source, "mean-look");
  assert.equal(meanLookBattle.opponent.effects.switchLockSources.at(-1)?.expiresRound, 4);

  const lockOnCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1, 1, 1, 1])
  });
  let lockOnBattle = await lockOnCombat.createBattle({
    encounterId: "FULL_RUNTIME_LOCK_ON",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["lock-on", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["harden"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  lockOnBattle = await lockOnCombat.usePlayerMove(lockOnBattle, "lock-on");
  assert.equal(lockOnBattle.player.effects.forcedHitSources.at(-1)?.usesRemaining, 1);
  assert.equal(
    lockOnBattle.player.effects.forcedHitSources.at(-1)?.targetCombatantId,
    lockOnBattle.opponent.combatantId
  );

  lockOnBattle = await lockOnCombat.endPlayerTurn(lockOnBattle);
  lockOnBattle = await lockOnCombat.useOpponentTurn(lockOnBattle);
  lockOnBattle = await lockOnCombat.usePlayerMove(lockOnBattle, "tackle");
  const lockedAttack = [...lockOnBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(lockedAttack?.natural, 1);
  assert.equal(lockedAttack?.hit, true);
  assert.equal(lockedAttack?.forcedHitConsumed, "lock-on");
});

test("weather moves persist offline battle state and Weather Ball consumes that state", async () => {
  const weatherCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let weatherBattle = await weatherCombat.createBattle({
    encounterId: "FULL_RUNTIME_RAIN_DANCE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["rain-dance"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["harden"] }
  });
  weatherBattle = await weatherCombat.usePlayerMove(weatherBattle, "rain-dance");
  assert.deepEqual(weatherBattle.environment.weather, {
    kind: "rain",
    source: "rain-dance",
    sourceSide: "player",
    startedRound: 1,
    expiresRound: 6
  });

  const sunCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let sunBattle = await sunCombat.createBattle({
    encounterId: "FULL_RUNTIME_SUNNY_DAY",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["sunny-day"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["harden"] }
  });
  sunBattle = await sunCombat.usePlayerMove(sunBattle, "sunny-day");
  assert.equal(sunBattle.environment.weather.kind, "harsh-sunlight");
  assert.equal(sunBattle.environment.weather.expiresRound, 6);

  const ballCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 1, 1, 1, 1, 1])
  });
  let ballBattle = await ballCombat.createBattle({
    encounterId: "FULL_RUNTIME_WEATHER_BALL",
    environment: { weather: "rain" },
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["weather-ball"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["harden"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  ballBattle = await ballCombat.usePlayerMove(ballBattle, "weather-ball");
  const weatherAttack = [...ballBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(weatherAttack?.hit, true);
  assert.equal(weatherAttack?.weather, "rain");
  assert.equal(weatherAttack?.damageType, "water");
  assert.equal(weatherAttack?.damageDiceMultiplier, 2);
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


test("Meditate, Cosmic Power and Victory Dance affect every saving-throw path", async () => {
  const meditateCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let meditateBattle = await meditateCombat.createBattle({
    encounterId: "FULL_RUNTIME_MEDITATE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["meditate"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  meditateBattle = await meditateCombat.usePlayerMove(meditateBattle, "meditate");
  assert.equal(meditateBattle.player.effects.attackModifierSources.at(-1).value, 2);
  assert.equal(meditateBattle.player.effects.saveModifierSources.at(-1).value, 2);
  const meditateSave = resolveSavingThrow({
    defender: meditateBattle.player,
    attribute: "wis",
    dc: 12,
    dice: new SequenceDice([10]),
    round: meditateBattle.round
  });
  assert.equal(meditateSave.effectModifier, 2);
  assert.equal(meditateSave.total, 12);

  const cosmicCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let cosmicBattle = await cosmicCombat.createBattle({
    encounterId: "FULL_RUNTIME_COSMIC_POWER",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["cosmic-power"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  cosmicBattle = await cosmicCombat.usePlayerMove(cosmicBattle, "cosmic-power");
  const cosmicSave = resolveSavingThrow({
    defender: cosmicBattle.player,
    attribute: "con",
    dc: 15,
    dice: new SequenceDice([4, 16]),
    round: cosmicBattle.round
  });
  assert.equal(cosmicSave.effectAdvantage, true);
  assert.equal(cosmicSave.mode, "advantage");
  assert.equal(cosmicSave.natural, 16);

  const frozen = structuredClone(cosmicBattle.player);
  applyStatus(frozen, "Frozen", { sourceProficiencyBonus: 2 });
  const frozenEvents = endTurnStatus(frozen, new SequenceDice([2, 18]), 3, cosmicBattle.round);
  const frozenSave = frozenEvents.find((event) => event.type === "frozen_break_check");
  assert.equal(frozenSave.advantage, true);
  assert.deepEqual(frozenSave.rolls, [2, 18]);

  const victoryCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let victoryBattle = await victoryCombat.createBattle({
    encounterId: "FULL_RUNTIME_VICTORY_DANCE",
    playerPokemon: { speciesId: "eevee", level: 10, moveIds: ["victory-dance"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  victoryBattle = await victoryCombat.usePlayerMove(victoryBattle, "victory-dance");
  assert.equal(victoryBattle.player.effects.attackModifierSources.at(-1).value, 2);
  assert.equal(victoryBattle.player.effects.acModifierSources.at(-1).value, 2);
  assert.equal(victoryBattle.player.effects.saveModifierSources.at(-1).value, 2);
});


test("Geomancy and No Retreat execute attack advantage, save advantage, speed and switching locks", async () => {
  const geomancyCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let geomancyBattle = await geomancyCombat.createBattle({
    encounterId: "FULL_RUNTIME_GEOMANCY",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["geomancy", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  const baseSpeed = geomancyBattle.player.turn.movementRemaining;
  geomancyBattle = await geomancyCombat.usePlayerMove(geomancyBattle, "geomancy");
  assert.equal(geomancyBattle.player.turn.movementRemaining, baseSpeed + 10);
  assert.equal(geomancyBattle.player.concentration?.moveId, "geomancy");
  assert.equal(geomancyBattle.player.effects.attackAdvantageSources.at(-1).source, "geomancy");
  assert.equal(geomancyBattle.player.effects.saveAdvantageSources.at(-1).source, "geomancy");

  const noRetreatCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let noRetreatBattle = await noRetreatCombat.createBattle({
    encounterId: "FULL_RUNTIME_NO_RETREAT",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["no-retreat", "tackle"] },
    playerBench: [{ speciesId: "pikachu", level: 5, moveIds: ["tackle"] }],
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  noRetreatBattle = await noRetreatCombat.usePlayerMove(noRetreatBattle, "no-retreat");
  assert.equal(noRetreatBattle.player.effects.attackAdvantageSources.at(-1).source, "no-retreat");
  assert.equal(noRetreatBattle.player.effects.saveAdvantageSources.at(-1).source, "no-retreat");
  assert.equal(noRetreatBattle.player.effects.escapeLockSources.at(-1).source, "no-retreat");

  await assert.rejects(
    () => noRetreatCombat.switchPlayer(noRetreatBattle, 0),
    /no-retreat prevents voluntary switching/
  );
});


test("Clangorous Soul pays typeless HP and grants encounter-long capped combat bonuses", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 2, 3, 4])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_CLANGOROUS_SOUL",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["clangorous-soul"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 50, y: 0 }
  });
  const hpBefore = battle.player.hp.current;
  battle = await combat.usePlayerMove(battle, "clangorous-soul");
  const event = battle.log.find((entry) => entry.type === "special_self_move");
  assert.equal(event.selfDamage, 9);
  assert.equal(battle.player.hp.current, hpBefore - 9);
  assert.equal(battle.player.effects.attackModifierSources.at(-1).value, 1);
  assert.equal(battle.player.effects.acModifierSources.at(-1).value, 1);
  assert.equal(battle.player.effects.damageModifierSources.at(-1).value, 1);
  assert.equal(battle.player.effects.attackModifierSources.at(-1).expiresRound, null);
});


test("Iron Defense, Defense Curl, Calm Mind and Tail Glow use generic resistance and STAB effects", async () => {
  const defenseCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let defenseBattle = await defenseCombat.createBattle({
    encounterId: "FULL_RUNTIME_IRON_DEFENSE",
    playerPokemon: { speciesId: "bulbasaur", level: 5, moveIds: ["iron-defense"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  defenseBattle = await defenseCombat.usePlayerMove(defenseBattle, "iron-defense");
  assert.equal(defenseBattle.player.effects.acModifierSources.at(-1).value, 6);
  assert.equal(
    damageProfile({ type: "fire", attack: { scope: "ranged" } }, defenseBattle.player, defenseBattle.round).multiplier,
    1
  );
  assert.equal(
    damageProfile({ type: "normal", attack: { scope: "ranged" } }, defenseBattle.player, defenseBattle.round).multiplier,
    0.5
  );

  const curlCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let curlBattle = await curlCombat.createBattle({
    encounterId: "FULL_RUNTIME_DEFENSE_CURL",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["defense-curl"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  curlBattle = await curlCombat.usePlayerMove(curlBattle, "defense-curl");
  assert.equal(curlBattle.player.effects.acModifierSources.at(-1).value, 4);
  assert.equal(
    damageProfile({ type: "normal", attack: { scope: "ranged" } }, curlBattle.player, curlBattle.round).multiplier,
    0.5
  );
  assert.equal(
    damageProfile({ type: "fire", attack: { scope: "ranged" } }, curlBattle.player, curlBattle.round).multiplier,
    1
  );

  const data = new Poke5eDataRepository();
  const tackle = await data.getMove("tackle");

  const stabCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let stabBattle = await stabCombat.createBattle({
    encounterId: "FULL_RUNTIME_TAIL_GLOW",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["tail-glow", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  stabBattle = await stabCombat.usePlayerMove(stabBattle, "tail-glow");
  assert.equal(calculateMoveStats(stabBattle.player, tackle, stabBattle.round).stab, 6);
  assert.equal(stabBattle.player.concentration?.moveId, "tail-glow");

  const calmCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let calmBattle = await calmCombat.createBattle({
    encounterId: "FULL_RUNTIME_CALM_MIND",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["calm-mind", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  calmBattle = await calmCombat.usePlayerMove(calmBattle, "calm-mind");
  assert.equal(calculateMoveStats(calmBattle.player, tackle, calmBattle.round).stab, 6);
});


test("Focus Energy expands critical range and Aqua Ring heals at each end turn under concentration", async () => {
  const focusCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 18, 3, 4])
  });
  let focusBattle = await focusCombat.createBattle({
    encounterId: "FULL_RUNTIME_FOCUS_ENERGY",
    playerPokemon: { speciesId: "pikachu", level: 5, moveIds: ["focus-energy", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  focusBattle = await focusCombat.usePlayerMove(focusBattle, "focus-energy");
  focusBattle = await focusCombat.usePlayerMove(focusBattle, "tackle");
  const focusAttack = [...focusBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(focusAttack.criticalThreshold, 18);
  assert.equal(focusAttack.critical, true);
  assert.equal(focusAttack.attackRoll.natural, 18);

  const aquaCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let aquaBattle = await aquaCombat.createBattle({
    encounterId: "FULL_RUNTIME_AQUA_RING",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["aqua-ring"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });
  aquaBattle.player.hp.current = Math.max(1, aquaBattle.player.hp.max - 10);
  const before = aquaBattle.player.hp.current;
  aquaBattle = await aquaCombat.usePlayerMove(aquaBattle, "aqua-ring");
  assert.equal(aquaBattle.player.concentration?.moveId, "aqua-ring");
  aquaBattle = await aquaCombat.endPlayerTurn(aquaBattle);
  assert.equal(aquaBattle.player.hp.current, before + 3);
  assert.ok(
    aquaBattle.player.effects.ongoingEffects.some((effect) => effect.kind === "aqua-ring")
  );
});



test("Magnet Rise blocks damaging and non-damaging Ground moves for its concentration duration", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_MAGNET_RISE",
    playerPokemon: { speciesId: "pikachu", level: 5, moveIds: ["magnet-rise"] },
    opponent: { speciesId: "sandshrew", level: 5, moveIds: ["sand-attack"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  battle = await combat.usePlayerMove(battle, "magnet-rise");
  assert.equal(battle.player.concentration?.moveId, "magnet-rise");
  assert.equal(battle.player.effects.typeImmunitySources.at(-1).type, "ground");
  assert.equal(
    damageProfile(
      { type: "ground", attack: { scope: "ranged" } },
      battle.player,
      battle.round
    ).multiplier,
    0
  );

  battle = await combat.endPlayerTurn(battle);
  battle = await combat.useMove(battle, "opponent", "sand-attack");
  const immune = [...battle.log].reverse().find((event) => event.type === "save_move");
  assert.equal(immune.immune, true);
  assert.equal(immune.immunityAbility, null);
  assert.equal(immune.immunityEffect, "magnet-rise");
});

test("Charge keeps AC until the next turn and activates doubled STAB only on that turn", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 18, 4])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_CHARGE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["charge", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  const data = new Poke5eDataRepository();
  const tackle = await data.getMove("tackle");

  battle = await combat.usePlayerMove(battle, "charge");
  assert.equal(battle.player.effects.acModifierSources.at(-1).value, 2);
  assert.equal(calculateMoveStats(battle.player, tackle, battle.round).stab, 3);
  assert.equal(battle.player.concentration?.moveId, "charge");

  battle = await combat.endPlayerTurn(battle);
  battle = await combat.advanceToPlayerOrEnd(battle);
  assert.equal(battle.round, 2);
  assert.equal(calculateMoveStats(battle.player, tackle, battle.round).stab, 6);
  assert.equal(
    battle.player.effects.acModifierSources.some(
      (source) => source.source === "charge-ac" && battle.round < source.expiresRound
    ),
    false
  );

  battle = await combat.usePlayerMove(battle, "tackle");
  const attack = [...battle.log].reverse().find((event) => event.type === "attack");
  assert.equal(attack.stab, 6);
});


test("Laser Focus and Mind Reader affect exactly one attack roll on the next turn", async () => {
  const laserCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 1, 4, 5])
  });
  let laserBattle = await laserCombat.createBattle({
    encounterId: "FULL_RUNTIME_LASER_FOCUS",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["laser-focus", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  laserBattle = await laserCombat.usePlayerMove(laserBattle, "laser-focus");
  assert.equal(laserBattle.player.concentration?.moveId, "laser-focus");
  assert.equal(laserBattle.player.effects.forcedCriticalSources.at(-1).startsRound, 2);

  laserBattle = await laserCombat.endPlayerTurn(laserBattle);
  laserBattle = await laserCombat.advanceToPlayerOrEnd(laserBattle);
  assert.equal(laserBattle.round, 2);

  laserBattle = await laserCombat.usePlayerMove(laserBattle, "tackle");
  const laserAttack = [...laserBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(laserAttack.natural, 1);
  assert.equal(laserAttack.forcedCritical, true);
  assert.equal(laserAttack.critical, true);
  assert.equal(laserAttack.hit, true);
  assert.equal(laserAttack.forcedCriticalConsumed, "laser-focus");
  assert.equal(laserBattle.player.concentration, null);

  const mindCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 20, 1, 4])
  });
  let mindBattle = await mindCombat.createBattle({
    encounterId: "FULL_RUNTIME_MIND_READER",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["mind-reader", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  mindBattle = await mindCombat.usePlayerMove(mindBattle, "mind-reader");
  assert.equal(mindBattle.player.effects.forcedHitSources.at(-1).startsRound, 2);

  mindBattle = await mindCombat.endPlayerTurn(mindBattle);
  mindBattle = await mindCombat.advanceToPlayerOrEnd(mindBattle);
  mindBattle = await mindCombat.usePlayerMove(mindBattle, "tackle");

  const mindAttack = [...mindBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(mindAttack.natural, 1);
  assert.equal(mindAttack.forcedHit, true);
  assert.equal(mindAttack.forcedCritical, false);
  assert.equal(mindAttack.critical, false);
  assert.equal(mindAttack.hit, true);
  assert.equal(mindAttack.forcedHitConsumed, "mind-reader");
  assert.equal(mindBattle.player.effects.forcedHitSources.at(-1).usesRemaining, 0);
});


test("Fillet Away pays 10 HP, boosts speed and consumes advantage on the next attack", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 5, 17, 4])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_FILLET_AWAY",
    playerPokemon: { speciesId: "pikachu", level: 5, moveIds: ["fillet-away", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });

  const hpBefore = battle.player.hp.current;
  const speedBefore = battle.player.turn.movementRemaining;
  battle = await combat.usePlayerMove(battle, "fillet-away");
  assert.equal(battle.player.hp.current, hpBefore - 10);
  assert.equal(battle.player.turn.movementRemaining, speedBefore + 15);
  assert.equal(battle.player.effects.attackAdvantageSources.at(-1).usesRemaining, 1);

  battle = await combat.usePlayerMove(battle, "tackle");
  const attack = [...battle.log].reverse().find((event) => event.type === "attack");
  assert.equal(attack.attackRoll.mode, "advantage");
  assert.equal(attack.attackRoll.natural, 17);
  assert.equal(attack.attackAdvantageConsumed, "fillet-away");
  assert.equal(battle.player.effects.attackAdvantageSources.at(-1).usesRemaining, 0);
});


test("Cotton Spore creates a real Restrained combat effect when its speed reduction reaches zero", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_COTTON_SPORE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["cotton-spore"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  });

  const baseSpeed = movementSpeed(battle.opponent, battle.round).value;
  battle.opponent.effects.speedModifierSources.push({
    source: "fixture",
    value: -(baseSpeed - 10),
    expiresRound: null
  });
  assert.equal(movementSpeed(battle.opponent, battle.round).value, 10);

  battle = await combat.usePlayerMove(battle, "cotton-spore");
  assert.equal(movementSpeed(battle.opponent, battle.round).value, 0);
  assert.equal(battle.opponent.effects.restrainedSources.at(-1).source, "cotton-spore");

  const tackle = await new Poke5eDataRepository().getMove("tackle");
  const restrainedAttack = resolveAttack({
    attacker: battle.opponent,
    defender: battle.player,
    move: tackle,
    dice: new SequenceDice([18, 5]),
    round: battle.round
  });
  assert.equal(restrainedAttack.attackRoll.mode, "disadvantage");
  assert.equal(restrainedAttack.attackRoll.natural, 5);

  const dexSave = resolveSavingThrow({
    defender: battle.opponent,
    attribute: "dex",
    dc: 10,
    dice: new SequenceDice([18, 5]),
    round: battle.round
  });
  assert.equal(dexSave.restrainedDex, true);
  assert.equal(dexSave.mode, "disadvantage");
  assert.equal(dexSave.natural, 5);
});


test("Sweet Scent grants exactly two attack advantages tied to the failed-save target", async () => {
  const combat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1])
  });
  let battle = await combat.createBattle({
    encounterId: "FULL_RUNTIME_SWEET_SCENT",
    playerPokemon: { speciesId: "pikachu", level: 5, moveIds: ["sweet-scent", "tackle"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["growl"] },
    opponentBench: [{ speciesId: "weedle", level: 1, moveIds: ["tackle"] }],
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  });

  battle = await combat.usePlayerMove(battle, "sweet-scent");
  const source = battle.player.effects.attackAdvantageSources.find(
    (entry) => entry.source === "sweet-scent"
  );
  assert.equal(source.usesRemaining, 2);
  assert.equal(source.targetCombatantId, battle.opponent.combatantId);

  const tackle = await new Poke5eDataRepository().getMove("tackle");
  const vsTarget = resolveAttack({
    attacker: battle.player,
    defender: battle.opponent,
    move: tackle,
    dice: new SequenceDice([4, 17, 3]),
    round: battle.round
  });
  assert.equal(vsTarget.attackRoll.mode, "advantage");

  const reserve = battle.opponentBench[0];
  const vsReserve = resolveAttack({
    attacker: battle.player,
    defender: reserve,
    move: tackle,
    dice: new SequenceDice([17, 3]),
    round: battle.round
  });
  assert.equal(vsReserve.attackRoll.mode, "normal");
});


test("Harden reduces status and move damage through the same temporary reduction source", async () => {
  const statusCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 6])
  });
  let statusBattle = await statusCombat.createBattle({
    encounterId: "FULL_RUNTIME_HARDEN_STATUS",
    playerPokemon: { speciesId: "caterpie", level: 5, moveIds: ["harden"] },
    opponent: { speciesId: "weedle", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  });
  applyStatus(statusBattle.player, "Poisoned");
  const hpBeforeStatus = statusBattle.player.hp.current;
  statusBattle = await statusCombat.usePlayerMove(statusBattle, "harden");
  statusBattle = await statusCombat.endPlayerTurn(statusBattle);
  const poisonEvent = statusBattle.log.find(
    (event) => event.type === "status_damage" && event.actor === "player"
  );
  assert.equal(poisonEvent.damageBeforeReduction, 3);
  assert.equal(poisonEvent.damage, 0);
  assert.equal(statusBattle.player.hp.current, hpBeforeStatus);

  const attackCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 18, 6, 4])
  });
  let attackBattle = await attackCombat.createBattle({
    encounterId: "FULL_RUNTIME_HARDEN_ATTACK",
    playerPokemon: { speciesId: "caterpie", level: 5, moveIds: ["harden"] },
    opponent: { speciesId: "weedle", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  attackBattle = await attackCombat.usePlayerMove(attackBattle, "harden");
  attackBattle = await attackCombat.endPlayerTurn(attackBattle);
  const hpBeforeAttack = attackBattle.player.hp.current;
  attackBattle = await attackCombat.useMove(attackBattle, "opponent", "tackle");
  const attackEvent = [...attackBattle.log].reverse().find((event) => event.type === "attack");
  assert.ok(attackEvent.damageBeforeReduction >= attackEvent.damage);
  assert.ok(attackEvent.damageReduction >= 0);
  assert.equal(hpBeforeAttack - attackBattle.player.hp.current, attackEvent.damage);
});


test("Kinesis boosts eligible movement modes and grants AC only against ranged attacks", async () => {
  const rangedCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1])
  });
  let rangedBattle = await rangedCombat.createBattle({
    encounterId: "FULL_RUNTIME_KINESIS_RANGED",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["kinesis"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["ember"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 20, y: 0 }
  });
  const baseSpeed = rangedBattle.player.turn.movementRemaining;
  const baseAc = rangedBattle.player.ac;
  rangedBattle = await rangedCombat.usePlayerMove(rangedBattle, "kinesis");
  assert.equal(rangedBattle.player.turn.movementRemaining, baseSpeed + 20);
  assert.equal(rangedBattle.player.effects.rangedAcModifierSources.at(-1).value, 2);
  rangedBattle = await rangedCombat.endPlayerTurn(rangedBattle);
  rangedBattle = await rangedCombat.useMove(rangedBattle, "opponent", "ember");
  const rangedAttack = [...rangedBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(rangedAttack.defenderAc, baseAc + 2);

  const meleeCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1, 1])
  });
  let meleeBattle = await meleeCombat.createBattle({
    encounterId: "FULL_RUNTIME_KINESIS_MELEE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["kinesis"] },
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 5, y: 0 }
  });
  const meleeBaseAc = meleeBattle.player.ac;
  meleeBattle = await meleeCombat.usePlayerMove(meleeBattle, "kinesis");
  meleeBattle = await meleeCombat.endPlayerTurn(meleeBattle);
  meleeBattle = await meleeCombat.useMove(meleeBattle, "opponent", "tackle");
  const meleeAttack = [...meleeBattle.log].reverse().find((event) => event.type === "attack");
  assert.equal(meleeAttack.defenderAc, meleeBaseAc);

  const burrowOnly = {
    speed: [{ type: "burrowing", value: 30 }],
    statuses: { nonVolatile: null },
    effects: {
      speedModifierSources: [{
        source: "kinesis",
        value: 20,
        types: ["walking", "flying", "swimming"],
        expiresRound: 10
      }],
      movementLockSources: [],
      restrainedSources: []
    }
  };
  assert.equal(movementSpeed(burrowOnly, 1).value, 30);
});

test("Healing Wish and Lunar Dance resolve on the next forced switch", async () => {
  const wishCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let wishBattle = await wishCombat.createBattle({
    encounterId: "FULL_RUNTIME_HEALING_WISH",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["healing-wish"] },
    playerBench: [{ speciesId: "pikachu", level: 5, moveIds: ["tackle"] }],
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });

  wishBattle.player.hp.current = 5;
  wishBattle.playerBench[0].hp.current = Math.max(1, wishBattle.playerBench[0].hp.max - 20);
  applyStatus(wishBattle.playerBench[0], "Poisoned");
  const wishBenchHpBefore = wishBattle.playerBench[0].hp.current;

  wishBattle = await wishCombat.usePlayerMove(wishBattle, "healing-wish");
  assert.equal(wishBattle.awaitingSwitch, "player");
  assert.equal(wishBattle.pendingSwitchEffects.player.healing, 5);
  wishBattle = await wishCombat.switchPlayer(wishBattle, 0);

  assert.equal(wishBattle.player.statuses.nonVolatile, null);
  assert.equal(
    wishBattle.player.hp.current,
    Math.min(wishBattle.player.hp.max, wishBenchHpBefore + 5)
  );
  assert.equal(wishBattle.pendingSwitchEffects.player, null);

  const lunarCombat = new Pokemon5eCombatEngine({
    dice: new SequenceDice([20, 1])
  });
  let lunarBattle = await lunarCombat.createBattle({
    encounterId: "FULL_RUNTIME_LUNAR_DANCE",
    playerPokemon: { speciesId: "eevee", level: 5, moveIds: ["lunar-dance"] },
    playerBench: [{ speciesId: "pikachu", level: 5, moveIds: ["tackle"] }],
    opponent: { speciesId: "caterpie", level: 1, moveIds: ["tackle"] },
    playerPosition: { x: 0, y: 0 },
    opponentPosition: { x: 30, y: 0 }
  });

  lunarBattle.playerBench[0].hp.current = 1;
  applyStatus(lunarBattle.playerBench[0], "Burned");
  lunarBattle = await lunarCombat.usePlayerMove(lunarBattle, "lunar-dance");
  assert.equal(lunarBattle.awaitingSwitch, "player");
  lunarBattle = await lunarCombat.switchPlayer(lunarBattle, 0);

  assert.equal(lunarBattle.player.hp.current, lunarBattle.player.hp.max);
  assert.equal(lunarBattle.player.statuses.nonVolatile, null);
  assert.equal(lunarBattle.pendingSwitchEffects.player, null);
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
