import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { applyFriendCareerModuleMilestone } from "../src/engine/npc-career-scheduler.mjs";

test("NPC careers advance even when player never meets them",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyFriendCareerModuleMilestone(s,"M01");
 for(const name of ["Mattew","Daniel","Edward","Fab"]) assert.equal(s.npcs[name].trainer.trainerLevel,2);
});

test("module milestone is idempotent across reload/re-entry",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyFriendCareerModuleMilestone(s,"M01");
 const once=structuredClone(s);
 applyFriendCareerModuleMilestone(s,"M01");
 assert.deepEqual(s,once);
});

test("planned acquisition waits for legal Pokemon level from resolver",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyFriendCareerModuleMilestone(s,"M02");
 assert.equal(s.npcs.Daniel.rosterCareer[1].acquired,false);
});

test("resolver-backed acquisition happens once and persists",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const levels={Mattew:{2:6},Daniel:{2:6},Edward:{2:6},Fab:{2:6}};
 applyFriendCareerModuleMilestone(s,"M02",{pokemonLevels:levels});
 for(const name of ["Mattew","Daniel","Edward","Fab"]){
  assert.equal(s.npcs[name].rosterCareer[1].acquired,true);
  assert.match(s.npcs[name].rosterCareer[1].acquiredAt,/M02/);
 }
 const snap=structuredClone(s);
 applyFriendCareerModuleMilestone(s,"M02",{pokemonLevels:levels});
 assert.deepEqual(s,snap);
});

test("M1-M12 schedule reaches canonical level, Path, specializations and six-member roster for every player choice",()=>{
 const canon={
  Luke:{path:"Tactician",specializations:["fire","grass","dragon"]},
  Mattew:{path:"Poké Mentor",specializations:["electric","steel","fighting"]},
  Daniel:{path:"Pokémon Collector",specializations:["ghost","psychic","fighting"]},
  Edward:{path:"Ace Trainer",specializations:["water","dark","ice"]},
  Fab:{path:"Commander",specializations:["poison","dragon","steel"]}
 };
 const modules=["M01","M02","M03","M04","M05","M06","M07","M08","M09","M10","M11","M12"];
 for(const protagonist of Object.keys(canon)){
  const s=createNewGameState({protagonist});
  const levels={};
  for(const name of Object.keys(canon)){
   if(name!==protagonist) levels[name]={2:6,3:8,4:9,5:10,6:11};
  }
  for(const m of modules) applyFriendCareerModuleMilestone(s,m,{pokemonLevels:levels});
  for(const [name,expected] of Object.entries(canon)){
   if(name===protagonist) continue;
   const npc=s.npcs[name];
   assert.equal(npc.trainer.trainerLevel,18,`${protagonist} -> ${name} level`);
   assert.equal(npc.trainer.trainerPath,expected.path,`${protagonist} -> ${name} Path`);
   assert.deepEqual([...npc.trainer.specializations].sort(),[...expected.specializations].sort(),`${protagonist} -> ${name} specializations`);
   assert.equal(npc.rosterCareer.length,6,`${protagonist} -> ${name} roster slots`);
   assert.equal(npc.rosterCareer.every(p=>p.acquired),true,`${protagonist} -> ${name} full roster acquired`);
   assert.deepEqual(npc.rosterCareer.map(p=>p.evolutionLine.at(-1)),npc.canonicalCareer.finalTeam,`${protagonist} -> ${name} canonical final roster`);
  }
 }
});
