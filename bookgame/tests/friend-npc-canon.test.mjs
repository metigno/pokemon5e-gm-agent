import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { progressCanonicalFriendNpc } from "../src/engine/npc-progression.mjs";

const names=["Luke","Mattew","Daniel","Edward","Fab"];
test("selected protagonist is never also generated as an NPC",()=>{
 for(const player of names){
  const s=createNewGameState({protagonist:player});
  assert.equal(s.npcs[player],undefined);
  assert.equal(names.filter(n=>n!==player).every(n=>s.npcs[n]?.canonicalCareer),true);
 }
});

test("each non-player friend follows its canonical final-team career",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const expected={Mattew:["electric","Ace Trainer"],Daniel:["ghost","Researcher"],Edward:["water","Ace Trainer"],Fab:["poison","Type Master"]};
 for(const [name,[spec,path]] of Object.entries(expected)){
  assert.deepEqual(s.npcs[name].trainer.specializations,[spec]);
  const lv2=progressCanonicalFriendNpc(s.npcs[name],2);
  assert.equal(lv2.trainer.trainerPath,path);
 }
});

test("Luke receives his NPC canon when another friend is the protagonist",()=>{
 const s=createNewGameState({protagonist:"Mattew"});
 assert.deepEqual(s.npcs.Luke.trainer.specializations,["fire"]);
 const lv18=progressCanonicalFriendNpc(s.npcs.Luke,18);
 assert.equal(lv18.trainer.trainerPath,"Tactician");
 assert.deepEqual(lv18.trainer.specializations,["fire","grass","dragon"]);
 assert.equal(lv18.trainer.pokeslots,6);
 assert.equal(lv18.trainer.maxSr,15);
});

test("player choice never inherits the NPC scripted path",()=>{
 for(const player of names){
  const s=createNewGameState({protagonist:player});
  const fourNpcNames=names.filter(name=>name!==player);
  assert.equal(s.player.name,player);
  assert.equal(s.player.trainerPath,null);
  assert.deepEqual(s.player.specializations,[]);
  assert.equal(s.npcs[player],undefined);
  assert.equal(fourNpcNames.filter(name=>s.npcs[name]?.canonicalCareer).length,4);
 }
});
