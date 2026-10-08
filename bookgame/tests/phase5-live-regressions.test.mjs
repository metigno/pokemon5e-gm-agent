import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { Pokemon5eCombatEngine } from "../src/combat/combat-engine.mjs";
import { compileEcologyCatalog } from "../src/compiler/ecology-compiler.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { syncFriendCareerSchedule } from "../src/engine/npc-career-scheduler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState, experienceNeededAtLevel } from "../src/engine/state.mjs";
import { battlePokemonXpPool, pokemonLevelCapForState } from "../src/engine/pokemon-xp-balance.mjs";

const now = () => "2026-10-08T12:00:00.000Z";
const scenesRoot = new URL("../content/scenes/", import.meta.url);
const dataRoot = new URL("../../campaign/world/", import.meta.url);

async function inTempSaveDir(callback) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-phase5-"));
  try {
    return await callback(new SaveStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function firstRoadState(slot, { postM01 = false } = {}) {
  const state = createNewGameState({ protagonist: "Luke", slot, now });
  state.story.sceneId = "first-road";
  state.story.nodeId = "arrival";
  state.world.locationId = "asteria_ginestre";
  if (postM01) state.world.flags.m1_complete = true;
  // Make the baseline XP explicit, so this proves the combat reward and not
  // merely the initial runtime's default XP initialization.
  state.player.starter.xp = experienceNeededAtLevel(5);
  state.player.roster[0].xp = experienceNeededAtLevel(5);
  return state;
}

async function actualHoundourVictory({ postM01, saves, slot }) {
  const book = new BookgameEngine({ now });
  const combat = new Pokemon5eCombatEngine({ dice: new SequenceDice([15, 5, 15, 6]) });
  let state = await book.choose(firstRoadState(slot, { postM01 }), "send_starter");
  assert.equal(state.pending.encounterId, "HOUNDOUR_GINESTRE_001");
  let battle = await combat.createBattle(state.pending);
  // A nearly-fainted enemy is a legitimate resumable battle position. The
  // outcome is NOT fabricated: it comes from the real 2024 Ember action.
  battle.opponent.hp.current = 1;
  state = book.setCombatState(state, battle);
  await saves.save(state);
  const restored = await saves.load(slot);
  assert.deepEqual(restored.pending, state.pending, "Battle must survive reload before victory");

  battle = await combat.usePlayerMove(restored.pending.battle, "ember");
  assert.equal(battle.outcome, "win");
  assert.equal(battle.opponent.hp.current, 0);
  assert.ok(battle.log.some(entry => entry.type === "attack" && entry.actor === "player"));
  const pool = battlePokemonXpPool(battle);
  assert.ok(pool > 0, "Fainting a real opponent must produce positive Pokémon XP");

  const battleState = book.setCombatState(restored, battle);
  const resolved = await book.resolveCombatHandoffWithXp(battleState, "win");
  assert.equal(resolved.pending, null);
  assert.equal(resolved.story.sceneId, "first-road");
  assert.equal(resolved.story.nodeId, "combat_win");
  assert.equal(resolved.story.history.at(-1).pokemonXp.pool, pool);
  assert.equal(resolved.story.history.at(-1).pokemonXp.awarded.length, 1);
  assert.equal(resolved.player.starter.xp, resolved.player.roster[0].xp);
  await saves.save(resolved);
  const afterReload = await saves.load(slot);
  assert.deepEqual(afterReload.player.roster, resolved.player.roster);
  assert.deepEqual(afterReload.story.history, resolved.story.history);
  await assert.rejects(
    () => book.resolveCombatHandoffWithXp(afterReload, "win"),
    /handoff is pending/,
    "The same combat cannot award XP twice"
  );
  return { resolved, afterReload, pool };
}

test("FASE 5: actual move -> KO -> XP -> narrative return -> save/reload is atomic", async () => {
  await inTempSaveDir(async saves => {
    const { resolved, pool } = await actualHoundourVictory({
      postM01: true, saves, slot: "phase5-postm01-xp"
    });
    assert.equal(pokemonLevelCapForState(resolved), 6);
    assert.equal(resolved.player.roster[0].xp, experienceNeededAtLevel(5) + pool);
    assert.equal(resolved.player.roster[0].level, 5);
    assert.equal(resolved.player.trainerLevel, 1, "Pokémon XP must not silently level the Trainer");
    assert.equal(resolved.npcs.Mattew.trainer.trainerLevel, 3,
      "Off-screen NPC progression must still run with the real battle handoff");
  });
});

test("FASE 5: actual combat win at M01 cap never banks XP into M02", async () => {
  await inTempSaveDir(async saves => {
    const { resolved } = await actualHoundourVictory({
      postM01: false, saves, slot: "phase5-m01-cap"
    });
    assert.equal(pokemonLevelCapForState(resolved), 5);
    assert.equal(resolved.player.roster[0].xp, experienceNeededAtLevel(5));
    assert.equal(resolved.player.roster[0].level, 5);
    resolved.world.flags.m1_complete = true;
    assert.equal(pokemonLevelCapForState(resolved), 6);
    assert.equal(resolved.player.roster[0].xp, experienceNeededAtLevel(5),
      "No overflow may be unlocked by a later module transition");
  });
});

test("FASE 5: real M02 NPC sparring uses persistent Trainer Lv3 and Eevee Lv6, saved separately", async () => {
  await inTempSaveDir(async saves => {
    const book = new BookgameEngine({ now });
    let state = createNewGameState({ protagonist: "Luke", slot: "phase5-m02-npc", now });
    state.competition.rank = "E";
    Object.assign(state.world.flags, {
      m1_complete: true, m02_unlocked: true, m2_active: true,
      friends_split: true, a2_friend_news_available: true
    });
    state.world.locationId = "borgo_salice";
    state.story.sceneId = "m02-friend-beat-02";
    state.story.nodeId = "mattew_combat_handoff";
    state = await book.choose(state, "fight_mattew");

    assert.equal(state.pending.opponent.species, "Eevee");
    assert.equal(state.pending.opponent.level, 6);
    assert.equal(state.npcs.Mattew.trainer.trainerLevel, 3);
    assert.equal(state.pending.opponentTrainerId, "Mattew");
    assert.equal(state.pending.opponentTrainerLevel, 3);
    assert.equal(state.pending.opponentRegistered, true,
      "A persistent friend's Pokémon is not wild or capturable");

    const battle = await new Pokemon5eCombatEngine({
      dice: new SequenceDice([15, 5])
    }).createBattle(state.pending);
    assert.equal(battle.opponent.level, 6);
    assert.equal(battle.opponentTrainerLevel, 3);
    assert.equal(battle.opponentRegistered, true);
    state = book.setCombatState(state, battle);
    await saves.save(state);
    const loaded = await saves.load(state.slot);
    assert.equal(loaded.pending.battle.opponentTrainerLevel, 3);
    assert.equal(loaded.pending.battle.opponent.level, 6);
    assert.equal(loaded.npcs.Mattew.trainer.trainerLevel, 3);
    assert.deepEqual(loaded.pending.battle, battle);
    syncFriendCareerSchedule(loaded);
    assert.equal(loaded.npcs.Mattew.rosterCareer[1].acquired, true);
  });
});

test("FASE 5: skip M01->M09 on five save files, repair NPC acquisitions once, reload idempotently", async () => {
  await inTempSaveDir(async saves => {
    for (const protagonist of ["Luke", "Mattew", "Daniel", "Edward", "Fab"]) {
      const slot = "phase5-" + protagonist.toLowerCase();
      const state = createNewGameState({ protagonist, slot, now });
      // Simulate a legal older save with a far-ahead completed milestone
      // but no intermediate NPC-career event records.
      state.world.flags.m8_complete = true;
      syncFriendCareerSchedule(state);
      assert.equal(pokemonLevelCapForState(state), 20);
      for (const [name, npc] of Object.entries(state.npcs)) {
        if (!npc.canonicalCareer) continue;
        const owned = npc.rosterCareer.filter(mon => mon.acquired);
        assert.equal(owned.length, 6, protagonist + " -> " + name + " full M09 NPC roster");
        assert.ok(owned.every(mon => mon.pokemonLevel <= 20));
        const acquisitionIds = owned.map(mon => mon.acquiredAt).filter(Boolean);
        assert.equal(new Set(acquisitionIds).size, acquisitionIds.length,
          protagonist + " -> " + name + " acquired only once");
      }
      const snapshot = structuredClone({ events: state.events, npcs: state.npcs });
      await saves.save(state);
      const reloaded = await saves.load(slot);
      syncFriendCareerSchedule(reloaded);
      syncFriendCareerSchedule(reloaded);
      assert.deepEqual({ events: reloaded.events, npcs: reloaded.npcs }, snapshot,
        protagonist + ": milestone recovery must not repeat captures or evolutions");
    }
  });
});

test("FASE 5: all playable static combat handoffs instantiate against the actual offline 2024 rules", async () => {
  const files = (await readdir(scenesRoot)).filter(file => file.endsWith(".json")).sort();
  assert.ok(files.length >= 155);
  let staticCount = 0;
  let worldDynamic = 0;
  const errors = [];
  for (const file of files) {
    const scene = JSON.parse(await readFile(new URL(file, scenesRoot), "utf8"));
    for (const [nodeId, node] of Object.entries(scene.nodes ?? {})) {
      for (const choice of node.choices ?? []) {
        const handoff = choice.combat;
        if (!handoff) continue;
        const dynamic = Number.isInteger(handoff.competition?.worldOpponentIndex) ||
          ["R16", "QF", "SF", "FINAL"].includes(handoff.competition?.worldKnockoutRound);
        if (dynamic) {
          worldDynamic++;
          assert.equal(handoff.opponent, undefined, file + ": worlds must use persistent rosters");
          continue;
        }
        staticCount++;
        try {
          const battle = await new Pokemon5eCombatEngine({
            dice: new SequenceDice([15, 5])
          }).createBattle({
            encounterId: handoff.encounterId,
            playerPokemon: { species: "Eevee", level: 5 },
            opponent: handoff.opponent,
            opponentBench: handoff.opponentBench ?? [],
            opponentRegistered: Boolean(handoff.opponentRegistered || handoff.competition)
          });
          assert.equal(battle.opponent.level, handoff.opponent.level);
          assert.equal(battle.opponentBench.length, handoff.opponentBench?.length ?? 0);
          for (const mon of [battle.opponent, ...battle.opponentBench]) {
            assert.ok(mon.moveIds.length > 0);
            assert.ok(mon.hp.max > 0);
            assert.ok(mon.level >= 1 && mon.level <= 20);
          }
        } catch (error) {
          errors.push(file + "#" + nodeId + "/" + choice.id + ": " + error.message);
        }
      }
    }
  }
  assert.ok(staticCount >= 61, "Cover all authored Pokémon combat handoffs");
  assert.equal(worldDynamic, 7, "Retain dynamic World roster handoffs");
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("FASE 5: real M01 ecology -> wild battle -> capture -> save/reload never bypasses XP caps", async () => {
  const compiled = await compileEcologyCatalog({
    profilesDir: new URL("../content/ecology/", import.meta.url).pathname,
    zonePoolsFile: new URL("ecology/ZONE_POOLS.json", dataRoot).pathname,
    distributionFile: new URL("ecology/SPECIES_DISTRIBUTION.json", dataRoot).pathname,
    faunaIndexFile: new URL("fauna/ASTERIA_FAUNA_INDEX.json", dataRoot).pathname
  });
  assert.equal(compiled.valid, true, JSON.stringify(compiled.errors));
  await inTempSaveDir(async saves => {
    const book = new BookgameEngine({
      ecology: compiled.catalog,
      dice: new SequenceDice([1]), now
    });
    let state = createNewGameState({
      protagonist: "Luke", slot: "phase5-ecology-capture", now
    });
    state.world.minuteOfDay = 600;
    state.world.time = "day";
    state.story.sceneId = "m01-farm-first-arrival";
    state.story.nodeId = "approach";
    state.world.locationId = "asteria_farm_road";
    state.player.inventory.push("Pokeball");

    state = await book.choose(state, "field_wildlife");
    const sighting = state.ecology.lastEncounter;
    assert.ok(sighting, "A real compiled zone should generate an ordinary encounter");
    assert.ok(sighting.level >= 1 && sighting.level <= 4);
    assert.ok(["wooloo", "shinx", "growlithe-hisui"].includes(sighting.speciesId));
    const available = await book.present(state);
    const engage = available.choices.find(choice => choice.combat && choice.combat.opponentRegistered === false);
    assert.ok(engage, "Selected ordinary fauna is encounterable and capturable");

    state = await book.choose(state, engage.id);
    assert.equal(state.pending.opponent.level, sighting.level);
    assert.equal(state.pending.opponentRegistered, false);
    assert.ok(sighting.level <= pokemonLevelCapForState(state));
    const combat = new Pokemon5eCombatEngine({
      dice: new SequenceDice([15, 5, 20])
    });
    let battle = await combat.createBattle(state.pending);
    assert.equal(battle.opponent.level, sighting.level);
    // Reachable capture checkpoint with low HP; success still resolves with
    // the actual Pokémon 5e capture action, including the consumable ball.
    battle.opponent.hp.current = 1;
    state = book.setCombatState(state, battle);
    await saves.save(state);
    const loaded = await saves.load(state.slot);
    assert.deepEqual(loaded.pending.battle, battle);
    const attempt = await combat.attemptPlayerCapture(loaded.pending.battle, "pokeball");
    assert.equal(attempt.result.legal, true, JSON.stringify(attempt.result));
    assert.equal(attempt.result.captured, true, JSON.stringify(attempt.result));
    assert.equal(attempt.battle.outcome, "captured");

    const battleState = book.setCombatState(loaded, attempt.battle);
    const resolved = await book.resolveCombatHandoffWithXp(battleState, "captured");
    assert.equal(resolved.pending, null);
    assert.equal(resolved.player.roster.length, 2);
    assert.equal(resolved.player.roster[1].level, sighting.level);
    assert.equal(resolved.player.roster[1].speciesId, sighting.speciesId);
    assert.equal(resolved.player.roster[0].level, 5);
    assert.equal(resolved.story.history.at(-1).pokemonXp, undefined,
      "Capture must not also award combat victory XP");
    assert.equal(resolved.player.inventory.some(item => /pokeball/i.test(String(item))), false,
      "A real capture consumes its Poké Ball");
    await saves.save(resolved);
    const reloaded = await saves.load(state.slot);
    assert.deepEqual(reloaded.player.roster, resolved.player.roster);
    assert.deepEqual(reloaded.ecology, resolved.ecology);
    assert.deepEqual(reloaded.player.secondPokemonAcquisition, resolved.player.secondPokemonAcquisition);
  });
});
