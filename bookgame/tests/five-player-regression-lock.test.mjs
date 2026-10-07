import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  completeTrainerCreation,
  createNewGameState
} from "../src/engine/state.mjs";
import {
  applyTrainerProgressionEffect,
  resolveTrainerProgressionChoice,
  syncCampaignTrainerProgression
} from "../src/engine/trainer-progression.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";

const fixedNow = () => "2026-10-07T14:06:00.000Z";

const FIVE = {
  Luke: { npcPath: "Tactician", playerPath: "ace-trainer", specialization: "water" },
  Mattew: { npcPath: "Poké Mentor", playerPath: "tactician", specialization: "fire" },
  Daniel: { npcPath: "Pokémon Collector", playerPath: "ace-trainer", specialization: "grass" },
  Edward: { npcPath: "Ace Trainer", playerPath: "tactician", specialization: "electric" },
  Fab: { npcPath: "Commander", playerPath: "ace-trainer", specialization: "ghost" }
};

test("all Five keep free player progression across save/reload while the other four remain canonical NPCs", async () => {
  let dir;
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "p5e-five-player-regression-"));
    const store = new SaveStore(dir);

    for (const [name, canon] of Object.entries(FIVE)) {
      let state = createNewGameState({
        protagonist: name,
        startAtIntro: true,
        slot: `five-${name.toLowerCase()}`,
        now: fixedNow
      });

      state = completeTrainerCreation(state, { specialization: canon.specialization });
      assert.equal(state.player.trainerPath, null, name);

      applyTrainerProgressionEffect(state, {
        type: "trainer_milestone_level",
        milestoneId: "M01_COMPLETE",
        level: 3
      });
      resolveTrainerProgressionChoice(state, `trainer_path_${canon.playerPath}`);
      syncCampaignTrainerProgression(state);

      assert.equal(state.player.trainerPath, canon.playerPath, name);
      assert.notEqual(state.player.trainerPath, canon.npcPath, `${name} must not inherit NPC path`);
      assert.equal(state.npcs[name], undefined, name);

      const otherNames = Object.keys(FIVE).filter((other) => other !== name);
      assert.equal(otherNames.length, 4);
      for (const other of otherNames) {
        assert.ok(state.npcs[other]?.canonicalCareer, `${name} -> ${other}`);
        assert.equal(
          state.npcs[other]?.state?.canonicalCareer?.path,
          FIVE[other].npcPath,
          `${name} -> ${other} canonical path`
        );
      }

      await store.save(state);
      const loaded = await store.load(state.slot);
      assert.deepEqual(loaded, state, `${name} player/NPC split must survive save/reload`);
    }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});
