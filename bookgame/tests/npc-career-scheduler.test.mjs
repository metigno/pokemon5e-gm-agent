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

test("M1-M12 schedule reaches six-member career roster without early spawning",()=>{
 const s=createNewGameState({protagonist:"Mattew"});
 const levels={Luke:{2:6,3:8,4:9,5:10,6:11},Daniel:{2:6,3:8,4:9,5:10,6:11},Edward:{2:6,3:8,4:9,5:10,6:11},Fab:{2:6,3:8,4:9,5:10,6:11}};
 for(const m of ["M01","M02","M03","M04","M05","M06","M07","M08","M09","M10","M11","M12"]) applyFriendCareerModuleMilestone(s,m,{pokemonLevels:levels});
 for(const name of ["Luke","Daniel","Edward","Fab"]){
  assert.equal(s.npcs[name].trainer.trainerLevel,20);
  assert.equal(s.npcs[name].rosterCareer.filter(p=>p.acquired).length,6);
 }
});


test("canonical friend milestones stay inside every module band",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const expected={M01:2,M02:4,M03:7,M04:10,M05:13,M06:16,M07:18,M08:18,M09:19,M10:19,M11:20,M12:20};
 for(const [moduleId,level] of Object.entries(expected)){
  applyFriendCareerModuleMilestone(s,moduleId);
  for(const name of ["Mattew","Daniel","Edward","Fab"]) assert.equal(s.npcs[name].trainer.trainerLevel,level,moduleId+" "+name);
 }
});
