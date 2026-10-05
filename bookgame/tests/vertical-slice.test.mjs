import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const fixedNow = () => "2026-10-04T10:00:00.000Z";

function firstRoadState({ slot = "slot1" } = {}) {
  const state = createNewGameState({ protagonist: "Luke", slot, now: fixedNow });
  state.world.locationId = "asteria_ginestre";
  state.story.sceneId = "first-road";
  state.story.nodeId = "arrival";
  return state;
}

test("New Game creates a standalone persistent bookgame state", () => {
  const state = createNewGameState({ protagonist: "Luke", slot: "slot-test", now: fixedNow });
  assert.equal(state.player.name, "Luke");
  assert.deepEqual(state.player.starter, { species: "Growlithe", form: "Hisuian", level: 5 });
  assert.equal(state.world.flags.intro_complete, true);
  assert.equal(state.world.flags.free_roam, true);
  assert.equal(state.story.sceneId, "m01-release");
  assert.equal(state.story.nodeId, "free_roam");
  assert.equal(state.world.locationId, "asteria_campus_exit");
});

test("authored Animal Handling check selects success branch deterministically", async () => {
  const engine = new BookgameEngine({ dice: new SequenceDice([12]), now: fixedNow });
  const state = firstRoadState();
  const next = await engine.choose(state, "approach");

  assert.equal(next.lastRoll.natural, 12);
  assert.equal(next.lastRoll.modifier, 4);
  assert.equal(next.lastRoll.total, 16);
  assert.equal(next.lastRoll.notation, "d20+4=16");
  assert.equal(next.lastRoll.passed, true);
  assert.equal(next.story.nodeId, "trust");
  assert.equal(next.world.flags.houndour_ginestre_disposition, "calm");
});

test("same authored check selects failure branch when the roll misses DC", async () => {
  const engine = new BookgameEngine({ dice: new SequenceDice([2]), now: fixedNow });
  const state = firstRoadState();
  const next = await engine.choose(state, "approach");

  assert.equal(next.lastRoll.total, 6);
  assert.equal(next.lastRoll.passed, false);
  assert.equal(next.story.nodeId, "warning");
  assert.equal(next.world.flags.houndour_ginestre_disposition, "defensive");
});

test("combat choice hands authority to Pokémon 5e instead of inventing a narrative result", async () => {
  const engine = new BookgameEngine({ now: fixedNow });
  const state = firstRoadState();
  const next = await engine.choose(state, "send_starter");

  assert.equal(next.story.nodeId, "combat_handoff");
  assert.equal(next.pending.type, "pokemon5e_combat");
  assert.equal(next.pending.authority, "pokemon5e_rules");
  assert.equal(next.pending.opponent.species, "Houndour");
  assert.equal(next.pending.status, "awaiting_resolution");
});

test("combat resolver can return an outcome to the authored narrative graph", async () => {
  const engine = new BookgameEngine({ now: fixedNow });
  const initial = firstRoadState();
  const handedOff = await engine.choose(initial, "send_starter");
  const resumed = engine.resolveCombatHandoff(handedOff, "fled");

  assert.equal(resumed.pending, null);
  assert.equal(resumed.story.nodeId, "houndour_fled");
  assert.equal(resumed.story.history.at(-1).outcome, "fled");
});

test("save -> close -> reload preserves the exact durable state", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-bookgame-"));
  try {
    const store = new SaveStore(dir);
    const engine = new BookgameEngine({ dice: new SequenceDice([12]), now: fixedNow });
    let state = firstRoadState({ slot: "slot1" });
    state = await engine.choose(state, "approach");
    await store.save(state);

    const reloaded = await store.load("slot1");
    assert.deepEqual(reloaded, state);

    const view = await engine.present(reloaded);
    assert.equal(view.nodeId, "trust");
    assert.match(view.text, /non sei una minaccia immediata/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
