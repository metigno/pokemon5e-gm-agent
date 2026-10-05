import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileStory } from "../src/compiler/story-compiler.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";

const scenesDir = fileURLToPath(new URL("../content/scenes/", import.meta.url));
const modulesDir = fileURLToPath(new URL("../content/modules/", import.meta.url));
const fixedNow = () => "2026-10-05T06:30:00.000Z";

async function repository() {
  const bundle = await compileStory({ scenesDir, modulesDir });
  return {
    bundle,
    scenes: {
      async load(sceneId) {
        const scene = bundle.scenes[sceneId];
        if (!scene) throw new Error("missing scene " + sceneId);
        return structuredClone(scene);
      },
      async loadWorldEvents() {
        return structuredClone(bundle.worldEvents ?? []);
      }
    }
  };
}

function houndourState({ slot = "slot1" } = {}) {
  const state = createNewGameState({ protagonist: "Luke", slot, now: fixedNow });
  state.world.locationId = "asteria_ginestre";
  state.story.sceneId = "first-road";
  state.story.nodeId = "arrival";
  return state;
}

test("M1_02 leaving Houndour alone resolves the encounter without combat or punishment", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const start = houndourState();
  const rosterBefore = structuredClone(start.player.roster);
  const relationshipsBefore = Object.fromEntries(
    Object.entries(start.npcs).map(([id, npc]) => [id, npc.relationship.score])
  );

  const next = await engine.choose(start, "leave");

  assert.equal(next.story.nodeId, "road_continue");
  assert.equal(next.pending, null);
  assert.deepEqual(next.player.roster, rosterBefore);
  assert.equal(next.world.flags.houndour_ginestre_disposition, "left_alone");
  assert.equal(next.world.flags.houndour_ginestre_escalation, "none");
  assert.equal(next.world.flags.houndour_ginestre_available, false);
  assert.deepEqual(
    Object.fromEntries(Object.entries(next.npcs).map(([id, npc]) => [id, npc.relationship.score])),
    relationshipsBefore
  );
});

test("M1_02 successful Animal Handling calms Houndour and closes this encounter durably", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({
    scenes,
    dice: new SequenceDice([12]),
    now: fixedNow
  });
  let state = houndourState();

  state = await engine.choose(state, "approach");
  assert.equal(state.story.nodeId, "trust");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "calm");
  assert.equal(state.world.flags.houndour_ginestre_available, undefined);

  state = await engine.choose(state, "continue");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "calm");
  assert.equal(state.world.flags.houndour_ginestre_escalation, "deescalated");
  assert.equal(state.world.flags.houndour_ginestre_available, false);
});

test("M1_02 failed approach can de-escalate by backing away", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({
    scenes,
    dice: new SequenceDice([1]),
    now: fixedNow
  });
  let state = houndourState();

  state = await engine.choose(state, "approach");
  assert.equal(state.story.nodeId, "warning");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "defensive");

  state = await engine.choose(state, "back_away");
  assert.equal(state.story.nodeId, "road_continue");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "defensive");
  assert.equal(state.world.flags.houndour_ginestre_escalation, "avoided");
  assert.equal(state.world.flags.houndour_ginestre_available, false);
});

test("M1_02 choosing battle does not predetermine capture or mutate the roster", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  const start = houndourState();
  const rosterBefore = structuredClone(start.player.roster);

  const handedOff = await engine.choose(start, "send_starter");

  assert.equal(handedOff.pending.type, "pokemon5e_combat");
  assert.equal(handedOff.pending.authority, "pokemon5e_rules");
  assert.equal(handedOff.pending.encounterId, "HOUNDOUR_GINESTRE_001");
  assert.deepEqual(handedOff.player.roster, rosterBefore);
  assert.equal(handedOff.world.flags.houndour_ginestre_disposition, undefined);
  assert.equal(handedOff.world.flags.houndour_ginestre_available, undefined);
});

test("M1_02 legal capture persists the Pokémon first, then records the authored callback state", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = houndourState();

  state = await engine.choose(state, "send_starter");
  state = engine.setCombatState(state, {
    encounterId: "HOUNDOUR_GINESTRE_001",
    outcome: "captured",
    opponent: {
      speciesId: "houndour",
      name: "Houndour",
      level: 3,
      hp: { current: 5, max: 27 },
      statuses: { nonVolatile: null, volatile: [] },
      abilityId: "early-bird",
      moveIds: ["ember", "leer"],
      pp: { ember: 20, leer: 30 }
    }
  });
  state = engine.resolveCombatHandoff(state, "captured");

  assert.equal(state.story.nodeId, "houndour_captured");
  assert.equal(state.player.roster.length, 2);
  assert.equal(state.player.roster[1].speciesId, "houndour");
  assert.equal(state.player.secondPokemonAcquisition.encounterId, "HOUNDOUR_GINESTRE_001");
  assert.equal(state.world.flags.houndour_ginestre_disposition, undefined);

  state = await engine.choose(state, "continue");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "captured");
  assert.equal(state.world.flags.houndour_ginestre_escalation, "capture");
  assert.equal(state.world.flags.houndour_ginestre_available, false);
});

test("M1_02 a fled Houndour changes animal position without inventing moral penalties", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = houndourState();
  const rankBefore = state.competition.rank;

  state = await engine.choose(state, "send_starter");
  state = engine.resolveCombatHandoff(state, "fled");
  assert.equal(state.story.nodeId, "houndour_fled");

  state = await engine.choose(state, "continue");
  assert.equal(state.world.flags.houndour_ginestre_disposition, "fled");
  assert.equal(state.world.flags.houndour_ginestre_escalation, "battle_flight");
  assert.equal(state.world.flags.houndour_ginestre_available, false);
  assert.equal(state.competition.rank, rankBefore);
  assert.deepEqual(state.quests, {});
});

test("M1_02 resolved Houndour cannot reset when the player revisits the First Road", async () => {
  const { scenes } = await repository();
  const engine = new BookgameEngine({ scenes, now: fixedNow });
  let state = houndourState();

  state = await engine.choose(state, "leave");
  state.story.sceneId = "m01-first-road";
  state.story.nodeId = "road_entry";

  const view = await engine.present(state);
  const ids = view.choices.map((entry) => entry.id);

  assert.equal(ids.includes("continue_to_houndour"), false);
  assert.equal(ids.includes("pass_resolved_houndour_stretch"), true);

  state = await engine.choose(state, "pass_resolved_houndour_stretch");
  assert.equal(state.story.sceneId, "m01-ginestre-crossroads");
  assert.equal(state.story.nodeId, "crossroads");
});

test("M1_02 save/reload preserves captured callback state and second Pokémon exactly", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pokemon5e-m1-houndour-"));
  try {
    const { scenes } = await repository();
    const engine = new BookgameEngine({ scenes, now: fixedNow });
    const store = new SaveStore(dir);
    let state = houndourState({ slot: "m1-houndour" });

    state = await engine.choose(state, "send_starter");
    state = engine.setCombatState(state, {
      encounterId: "HOUNDOUR_GINESTRE_001",
      outcome: "captured",
      opponent: {
        speciesId: "houndour",
        name: "Houndour",
        level: 3,
        hp: { current: 7, max: 27 },
        statuses: { nonVolatile: null, volatile: [] },
        abilityId: "early-bird",
        moveIds: ["ember"],
        pp: { ember: 19 }
      }
    });
    state = engine.resolveCombatHandoff(state, "captured");
    state = await engine.choose(state, "continue");

    await store.save(state);
    const loaded = await store.load("m1-houndour");

    assert.deepEqual(loaded, state);
    assert.equal(loaded.world.flags.houndour_ginestre_disposition, "captured");
    assert.equal(loaded.world.flags.houndour_ginestre_available, false);
    assert.equal(loaded.player.roster[1].speciesId, "houndour");
    assert.equal(loaded.player.secondPokemonAcquisition.encounterId, "HOUNDOUR_GINESTRE_001");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
