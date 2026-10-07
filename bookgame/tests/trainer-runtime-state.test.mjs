import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  GAME_STATE_SCHEMA_VERSION,
  createNewGameState,
  migrateGameState
} from "../src/engine/state.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { equipTrainerGear, useTrainerFeature } from "../src/engine/trainer-actions.mjs";
import { applyTrainerCondition, applyTrainerDamage } from "../src/engine/trainer-survival.mjs";

const fixedNow = () => "2026-10-06T20:40:00.000Z";

test("new careers expose the canonical 2024 Trainer runtime without breaking RC0 aliases", () => {
  const state = createNewGameState({ protagonist: "Luke", slot: "trainer-runtime", now: fixedNow });
  assert.equal(state.schemaVersion, GAME_STATE_SCHEMA_VERSION);
  assert.equal(state.player.trainerClass, "pokemon-trainer");
  assert.equal(state.player.trainerPath, null);
  assert.equal(state.player.trainerLevel, 1);
  assert.equal(state.player.trainerXp, 0);
  assert.deepEqual(state.player.hp, { current: 8, max: 8 });
  assert.equal(state.player.ac, 10);
  assert.deepEqual(state.player.savingThrows, ["CHA"]);
  assert.deepEqual(state.player.hitDice, { die: "d6", current: 1, max: 1 });
  assert.equal(state.player.movement.walking, 30);
  assert.deepEqual(state.player.conditions, []);
  assert.deepEqual(state.player.classResources, {});
  assert.ok(state.player.classFeatures.includes("command-pokemon"));
  assert.deepEqual(state.player.starter, { species: "Growlithe", form: "Hisuian", level: 5 });
  assert.deepEqual(state.player.skills, ["Animal Handling", "Insight", "Survival"]);
});

test("RC0 schema migrates forward without losing authored career state", () => {
  const current = createNewGameState({ protagonist: "Daniel", slot: "legacy", now: fixedNow });
  const legacy = structuredClone(current);
  legacy.schemaVersion = 1;
  for (const key of [
    "trainerClass", "trainerPath", "trainerXp", "proficiencies", "savingThrows",
    "hp", "ac", "hitDice", "classResources", "classFeatures", "feats",
    "specializations", "equipment", "trainerGear", "conditions", "movement",
    "featureUsage", "persistentEffects", "death"
  ]) delete legacy.player[key];
  legacy.world.flags.m01_complete = true;
  legacy.story.nodeId = "legacy-node";
  legacy.player.inventory.push({ itemId: "poke-ball", quantity: 3 });

  const migrated = migrateGameState(legacy);
  assert.equal(migrated.schemaVersion, GAME_STATE_SCHEMA_VERSION);
  assert.equal(migrated.world.flags.m01_complete, true);
  assert.equal(migrated.story.nodeId, "legacy-node");
  assert.deepEqual(migrated.player.inventory, [{ itemId: "poke-ball", quantity: 3 }]);
  assert.equal(migrated.player.trainerClass, "pokemon-trainer");
  assert.deepEqual(migrated.player.hp, { current: 8, max: 8 });
  assert.equal(migrated.player.death.state, "alive");
});

test("SaveStore migrates RC0 saves on reload and preserves the three-slot-compatible slot id", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5e-bookgame-trainer-runtime-"));
  try {
    const store = new SaveStore(dir);
    const legacy = createNewGameState({ protagonist: "Fab", slot: "slot2", now: fixedNow });
    legacy.schemaVersion = 1;
    delete legacy.player.trainerClass;
    delete legacy.player.hp;
    delete legacy.player.death;
    await store.save(legacy);

    const loaded = await store.load("slot2");
    assert.equal(loaded.slot, "slot2");
    assert.equal(loaded.schemaVersion, GAME_STATE_SCHEMA_VERSION);
    assert.equal(loaded.player.trainerClass, "pokemon-trainer");
    assert.deepEqual(loaded.player.hp, { current: 8, max: 8 });
    assert.equal(loaded.player.death.state, "alive");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});


test("Trainer gameplay state survives save and reload for player and scripted NPC", async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"p5e-bookgame-trainer-e2e-"));
 try{
  const store=new SaveStore(dir);
  const s=createNewGameState({protagonist:"Luke",slot:"slot3",now:fixedNow});
  s.player.trainerGear.push({id:"field-kit"});
  s.player.classFeatures.push("test-feature");
  s.player.classResources.test={current:1,max:1};
  equipTrainerGear(s,{gearId:"field-kit"});
  useTrainerFeature(s,{featureId:"test-feature",resourceId:"test"});
  applyTrainerCondition(s,{condition:"poisoned"});
  applyTrainerDamage(s,{amount:3});

  s.npcs.Mattew.trainer.trainerGear.push({id:"mentor-kit"});
  equipTrainerGear(s,{actor:{kind:"npc",id:"Mattew"},gearId:"mentor-kit"});
  applyTrainerCondition(s,{actor:{kind:"npc",id:"Mattew"},condition:"restrained"});
  applyTrainerDamage(s,{actor:{kind:"npc",id:"Mattew"},amount:2});

  await store.save(s);
  const loaded=await store.load("slot3");
  assert.equal(loaded.player.equipment[0].id,"field-kit");
  assert.equal(loaded.player.classResources.test.current,0);
  assert.equal(loaded.player.featureUsage["test-feature"].uses,1);
  assert.deepEqual(loaded.player.conditions,["poisoned"]);
  assert.equal(loaded.player.hp.current,5);
  assert.equal(loaded.npcs.Mattew.trainer.equipment[0].id,"mentor-kit");
  assert.deepEqual(loaded.npcs.Mattew.trainer.conditions,["restrained"]);
  assert.equal(loaded.npcs.Mattew.trainer.hp.current,6);
 }finally{await rm(dir,{recursive:true,force:true});}
});
