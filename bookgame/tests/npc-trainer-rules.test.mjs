import test from "node:test";
import assert from "node:assert/strict";
import { createPersistentNpc, createTrainerRulesState } from "../src/engine/npc-state.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { progressCanonicalFriendNpc } from "../src/engine/npc-progression.mjs";

test("player friends and Blue use the universal Pokemon 5e Trainer schema",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 for(const id of ["Mattew","Daniel","Edward","Fab","Blue"]){
  assert.equal(s.npcs[id].trainer.ruleset,"2024");
  assert.equal(s.npcs[id].trainer.trainerClass,"Trainer");
  assert.equal(s.npcs[id].trainer.trainerLevel,1);
  assert.equal(s.npcs[id].trainer.trainerPath,null);
  assert.equal(s.npcs[id].trainer.pokeslots,3);
  assert.equal(s.npcs[id].trainer.maxSr,2);
 }
});

test("NPC Trainer Path is illegal before level 2",()=>{
 assert.throws(()=>createTrainerRulesState({trainerLevel:1,trainerPath:"Ace Trainer"}),/before level 2/i);
 const t=createTrainerRulesState({trainerLevel:2,trainerPath:"Ace Trainer",specializations:["Fire"]});
 assert.equal(t.trainerPath,"Ace Trainer");
 assert.deepEqual(t.specializations,["Fire"]);
});

test("NPC progression uses the same 2024 Pokeslot and Max SR table",()=>{
 assert.deepEqual([1,3,5,6,8,10,11,14,15,17].map(level=>{
  const t=createTrainerRulesState({trainerLevel:level});
  return [level,t.pokeslots,t.maxSr];
 }),[
  [1,3,2],[3,3,5],[5,4,5],[6,4,8],[8,4,10],
  [10,5,10],[11,5,12],[14,5,14],[15,6,14],[17,6,15]
 ]);
});

test("generic persistent trainers also receive a rules state",()=>{
 const npc=createPersistentNpc({id:"rookie_01",name:"Rookie",state:{trainerLevel:3,specializations:["Water"],trainerPath:"Ranger"}});
 assert.equal(npc.trainer.trainerClass,"Trainer");
 assert.equal(npc.trainer.trainerLevel,3);
 assert.equal(npc.trainer.trainerPath,"Ranger");
 assert.deepEqual(npc.trainer.specializations,["Water"]);
});


test("NPC Trainers expose the same persistent gameplay runtime surface as the player",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const npc=s.npcs.Mattew;
 for(const key of ["hp","ac","hitDice","skills","proficiencies","savingThrows","equipment","trainerGear","inventory","classResources","classFeatures","featureUsage","conditions","persistentEffects","death","movement"]){
  assert.ok(Object.hasOwn(npc.trainer,key),key);
 }
 assert.deepEqual(npc.trainer.hp,{current:7,max:7});
 assert.ok(npc.trainer.classFeatures.includes("command-pokemon"));
 assert.equal(npc.trainer.death.state,"alive");
});

test("scripted friend NPC runtime scales to the level where the NPC appears",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const mattew=progressCanonicalFriendNpc(s.npcs.Mattew,10);
 assert.equal(mattew.trainer.trainerLevel,10);
 assert.equal(mattew.trainer.trainerPath,"Poké Mentor");
 assert.ok(mattew.trainer.hp.max>8);
 assert.equal(mattew.trainer.hitDice.max,10);
 assert.equal(mattew.trainer.pokeslots,5);
 assert.equal(mattew.trainer.maxSr,10);
 assert.ok(mattew.trainer.classFeatures.includes("trainer-resolve"));
 assert.ok(mattew.trainer.classFeatures.includes("trainer-path:Poké Mentor:level-5"));
 assert.ok(mattew.trainer.classFeatures.includes("trainer-path:Poké Mentor:level-9"));
});

test("NPC level progression preserves spent resources, equipment and conditions",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 s.npcs.Daniel.trainer.equipment.push({id:"field-kit",equipped:true});
 s.npcs.Daniel.trainer.classResources.collectorFocus={current:0,max:1};
 s.npcs.Daniel.trainer.conditions.push("poisoned");
 s.npcs.Daniel.trainer.hp.current=3;
 const daniel=progressCanonicalFriendNpc(s.npcs.Daniel,5);
 assert.equal(daniel.trainer.equipment[0].id,"field-kit");
 assert.equal(daniel.trainer.classResources.collectorFocus.current,0);
 assert.ok(daniel.trainer.conditions.includes("poisoned"));
 assert.ok(daniel.trainer.hp.current<daniel.trainer.hp.max);
});
