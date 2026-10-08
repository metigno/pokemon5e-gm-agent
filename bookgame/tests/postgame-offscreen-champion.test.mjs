import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createNewGameState } from "../src/engine/state.mjs";
import { resolveUnattendedWorldChampionship } from "../src/engine/competition-state.mjs";
import { ensurePostgame } from "../src/engine/postgame-cycle.mjs";
import { WORLD_2060_SPECIES } from "../src/rules/world-roster-2060.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";

function missedState(protagonist = "Luke") {
  const state = createNewGameState({
    protagonist, slot: "slot1", now: () => "2060-07-17T12:00:00.000Z"
  });
  state.world.flags.main_story_complete = true;
  state.world.flags.worlds_missed = true;
  state.world.flags.world_qualified = false;
  return state;
}

test("Worlds Missed runs the canonical NPC simulation, never invents player wins", async () => {
  const state = missedState();
  const before = {
    player: structuredClone(state.player),
    npcs: structuredClone(state.npcs),
    flags: structuredClone(state.world.flags),
    quests: structuredClone(state.quests)
  };
  const champion = resolveUnattendedWorldChampionship(state);
  assert.ok(champion);
  assert.ok(Object.hasOwn(WORLD_2060_SPECIES, champion.name));
  assert.notEqual(champion.name, state.player.name);
  assert.notEqual(state.competition.world.currentWorldRunnerUp.name, state.player.name);
  assert.equal(state.competition.world.finalResolved, true);
  assert.equal(state.competition.world.hallOfFame.length, 1);
  assert.equal(state.competition.world.hallOfFame[0].champion.name, champion.name);
  assert.equal(state.competition.world.offscreenWorld.field.length, 32);
  assert.equal(state.competition.world.offscreenWorld.top16.length, 16);
  assert.equal(state.competition.world.offscreenWorld.knockoutMatches.length, 15);
  assert.equal(new Set(state.competition.world.offscreenWorld.field.map(x => x.id)).size, 32);

  // IDs and names must come from the exact 35-entrant authored M08 draw.
  const authored = JSON.parse(await readFile(
    new URL("../content/scenes/m08-world-draw.json", import.meta.url), "utf8"
  ));
  const drawEffect = Object.values(authored.nodes).flatMap(n => n.choices ?? [])
    .flatMap(choice => choice.effects ?? []).find(e => e.type === "competition_world_draw");
  assert.ok(drawEffect);
  const canonicalIds = new Map(drawEffect.participants.map(entry => [entry.name, entry.id]));
  for (const entrant of state.competition.world.offscreenWorld.field) {
    assert.equal(entrant.id, canonicalIds.get(entrant.name));
  }

  assert.deepEqual(state.player, before.player);
  assert.deepEqual(state.npcs, before.npcs);
  assert.deepEqual(state.quests, before.quests);
  assert.deepEqual(state.world.flags, before.flags);
  assert.equal(resolveUnattendedWorldChampionship(state).name, champion.name);
  assert.equal(state.competition.world.hallOfFame.length, 1);

  const ledger = ensurePostgame(state);
  assert.equal(ledger.championships.length, 1);
  assert.equal(ledger.championships[0].champion.name, champion.name);
  assert.equal(ledger.championships[0].result, "missed");

  const folder = await mkdtemp(path.join(os.tmpdir(), "p5e-offscreen-world-"));
  try {
    const store = new SaveStore(folder);
    await store.save(state);
    const loaded = await store.load("slot1");
    assert.deepEqual(loaded.competition.world.hallOfFame, state.competition.world.hallOfFame);
    assert.deepEqual(loaded.competition.world.offscreenWorld, state.competition.world.offscreenWorld);
    assert.equal(ensurePostgame(loaded).championships.length, 1);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("unattended World rejects qualified players and works with other protagonists", () => {
  const qualified = missedState();
  qualified.world.flags.world_qualified = true;
  assert.throws(() => resolveUnattendedWorldChampionship(qualified), /Worlds Missed outcome/);
  const state = missedState("Mattew");
  assert.notEqual(resolveUnattendedWorldChampionship(state).name, "Mattew");
});
