import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState, completeTrainerCreation } from "../src/engine/state.mjs";
import {
  advanceTrainerToLevel,
  resolveTrainerProgressionChoice,
  syncCampaignTrainerProgression
} from "../src/engine/trainer-progression.mjs";

const FIVE = ["Luke", "Mattew", "Daniel", "Edward", "Fab"];
const NPC_PATH = {
  Luke: "Tactician",
  Mattew: "Poké Mentor",
  Daniel: "Pokémon Collector",
  Edward: "Ace Trainer",
  Fab: "Commander"
};
const PLAYER_PATH = {
  Luke: "ace-trainer",
  Mattew: "tactician",
  Daniel: "commander",
  Edward: "poke-mentor",
  Fab: "pokemon-collector"
};

test("Five x 5 player freedom and Four NPC canon survive save/reload", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "p5e-five-persist-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new SaveStore(dir);

  for (const protagonist of FIVE) {
    let state = createNewGameState({
      protagonist,
      slot: protagonist.toLowerCase(),
      startAtIntro: true,
      now: () => "2026-10-07T16:52:34.000Z"
    });

    state = completeTrainerCreation(state, { specialization: "normal" });
    advanceTrainerToLevel(state, 2, { sourceMilestoneId: "FIVE_PERSISTENCE_TEST" });
    resolveTrainerProgressionChoice(state, `trainer_path_${PLAYER_PATH[protagonist]}`);
    syncCampaignTrainerProgression(state);

    assert.equal(state.player.name, protagonist);
    assert.equal(state.player.trainerPath, PLAYER_PATH[protagonist]);
    assert.notEqual(state.player.trainerPath, NPC_PATH[protagonist].toLowerCase().replaceAll("é", "e").replaceAll(" ", "-"));

    for (const friend of FIVE) {
      if (friend === protagonist) {
        assert.equal(state.npcs[friend], undefined);
        continue;
      }
      assert.equal(state.npcs[friend].state.canonicalCareer.path, NPC_PATH[friend]);
      assert.equal(state.npcs[friend].canonicalCareer.path, NPC_PATH[friend]);
    }

    await store.save(state);
    const loaded = await store.load(state.slot);
    assert.deepEqual(loaded, state, `${protagonist}: exact state must survive save/reload`);
    assert.equal(loaded.player.trainerPath, PLAYER_PATH[protagonist]);
    assert.equal(FIVE.filter((name) => name !== protagonist && loaded.npcs[name]?.canonicalCareer).length, 4);
  }
});
