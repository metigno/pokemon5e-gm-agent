import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { applyFriendCareerModuleMilestone, syncFriendCareerSchedule, FRIEND_POKEMON_LEVELS_BY_MODULE, FRIEND_EVOLUTIONS_BY_MODULE } from "../src/engine/npc-career-scheduler.mjs";
import { POKEMON_LEVEL_CAPS_BY_MODULE } from "../src/engine/pokemon-xp-balance.mjs";
import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { readFile } from "node:fs/promises";

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

test("missing pokemonLevels uses scheduled legal levels instead of losing the acquisition",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 applyFriendCareerModuleMilestone(s,"M02");
 assert.equal(s.npcs.Daniel.rosterCareer[1].acquired,true);
 assert.equal(s.npcs.Daniel.rosterCareer[1].pokemonLevel,5);
 assert.equal(s.npcs.Fab.rosterCareer[1].acquired,false, "Rayquaza must never be acquired in M02");
 assert.equal(s.npcs.Fab.rosterCareer[2].species,"Elekid");
 assert.equal(s.npcs.Fab.rosterCareer[2].acquired,true);
});

test("resolver-backed acquisition happens once and persists",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 const levels={Mattew:{2:6},Daniel:{2:6},Edward:{2:6},Fab:{3:6}};
 applyFriendCareerModuleMilestone(s,"M02",{pokemonLevels:levels});
 for(const name of ["Mattew","Daniel","Edward","Fab"]){
  const slot=name==="Fab"?3:2;
  assert.equal(s.npcs[name].rosterCareer[slot-1].acquired,true);
  assert.equal(s.npcs[name].rosterCareer[slot-1].pokemonLevel,6);
  assert.match(s.npcs[name].rosterCareer[slot-1].acquiredAt,/M02/);
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
   assert.deepEqual(npc.rosterCareer.map(p=>p.species),npc.canonicalCareer.finalTeam,`${protagonist} -> ${name} should actually evolve by M12`);
  }
 }
});

test("milestone recovery repairs old applied flags without duplicating Pokémon or evolution events",()=>{
 const state=createNewGameState({protagonist:"Luke"});
 state.events.npcCareerMilestones={M02:{applied:true,moduleId:"M02"}};
 state.world.flags.m1_complete=true;
 state.story.sceneId="m02-friend-beat-02";
 syncFriendCareerSchedule(state);
 const daniel=state.npcs.Daniel;
 assert.equal(daniel.rosterCareer[1].acquired,true);
 assert.match(daniel.rosterCareer[1].acquiredAt,/M02:Daniel:S2$/);
 assert.equal(state.npcs.Fab.rosterCareer[1].acquired,false);
 const first=structuredClone(state);
 syncFriendCareerSchedule(state);
 assert.deepEqual(state,first);
});

test("all Five have only their starter in M01, progress within 5e caps, and acquire personal legends at M09",()=>{
 const names=["Luke","Mattew","Daniel","Edward","Fab"];
 const legendary={Luke:3,Mattew:6,Daniel:3,Edward:5,Fab:2};
 const modules=Object.keys(FRIEND_POKEMON_LEVELS_BY_MODULE);
 for(const protagonist of names){
  const state=createNewGameState({protagonist});
  for(const moduleId of modules){
   applyFriendCareerModuleMilestone(state,moduleId);
   const cap=POKEMON_LEVEL_CAPS_BY_MODULE[moduleId];
   for(const [name,npc] of Object.entries(state.npcs)){
    if(!npc.canonicalCareer) continue;
    for(const pokemon of npc.rosterCareer){
     if(!pokemon.acquired) continue;
     assert.ok(pokemon.pokemonLevel>=5 && pokemon.pokemonLevel<=cap,
       `${moduleId} ${name} ${pokemon.species} Lv${pokemon.pokemonLevel} must be <=${cap}`);
    }
    const legendaryOwned=npc.rosterCareer[legendary[name]-1].acquired;
    assert.equal(legendaryOwned,modules.indexOf(moduleId)>=modules.indexOf("M09"),
      `${moduleId} ${name} legendary milestone`);
    if(moduleId==="M01") assert.equal(npc.rosterCareer.filter(p=>p.acquired).length,1);
    if(moduleId==="M09"){
     assert.equal(npc.rosterCareer.filter(p=>p.acquired).length,6);
     assert.deepEqual(npc.rosterCareer.map(p=>p.species),npc.canonicalCareer.finalTeam);
    }
   }
  }
 }
});

test("scripted evolutions obey the imported 2024 Pokémon 5e minimum levels",async()=>{
 const document=JSON.parse(await readFile(new URL("../data/poke5e/2024/evolutions.json",import.meta.url),"utf8"));
 const evolutions=document.values.filter(e=>!e.nonCanon);
 const state=createNewGameState({protagonist:"Luke"});
 for(const [moduleId, byFriend] of Object.entries(FRIEND_EVOLUTIONS_BY_MODULE)){
  for(const [name, stages] of Object.entries(byFriend)){
   if(name==="Luke") continue;
   const roster=state.npcs[name].rosterCareer;
   // Script state at the proper module, not the final level.
   for(const [slot,toSpecies] of stages){
    const pokemon=roster[slot-1];
    const fromIndex=pokemon.evolutionLine.indexOf(toSpecies)-1;
    const from=pokemon.evolutionLine[fromIndex];
    const slug=name=>name.toLowerCase();
    const evolution=evolutions.find(e=>e.from===slug(from)&&e.to===slug(toSpecies));
    assert.ok(evolution,`${name}: missing P5e evolution ${from} -> ${toSpecies}`);
    const actualLevel=FRIEND_POKEMON_LEVELS_BY_MODULE[moduleId][
      [1,...["M02","M04","M05","M07","M09"].map(m=>({
        M02:{Luke:2,Mattew:2,Daniel:2,Edward:2,Fab:3},
        M04:{Luke:6,Mattew:3,Daniel:4,Edward:3,Fab:4},
        M05:{Luke:5,Mattew:4,Daniel:5,Edward:4,Fab:5},
        M07:{Luke:4,Mattew:5,Daniel:6,Edward:6,Fab:6},
        M09:{Luke:3,Mattew:6,Daniel:3,Edward:5,Fab:2}
      })[m][name])].indexOf(slot)];
    const threshold=evolution.conditions.find(c=>c.type==="level")?.value??1;
    assert.ok(actualLevel>=threshold,`${moduleId}: ${from} -> ${toSpecies} requires Lv${threshold}, got Lv${actualLevel}`);
   }
  }
 }
});

test("real M02 battle handoff uses the NPC saved Pokémon level rather than level 3",async()=>{
 const state=createNewGameState({protagonist:"Luke"});
 state.competition.rank="E";
 Object.assign(state.world.flags,{
  m1_complete:true,m02_unlocked:true,m2_active:true,friends_split:true,
  a2_friend_news_available:true
 });
 state.world.locationId="borgo_salice";
 state.story.sceneId="m02-friend-beat-02";
 state.story.nodeId="mattew_combat_handoff";
 const engine=new BookgameEngine();
 const next=await engine.choose(state,"fight_mattew");
 assert.equal(next.pending.opponent.species,"Eevee");
 assert.equal(next.pending.opponent.level,6);
 assert.equal(next.npcs.Mattew.rosterCareer[0].pokemonLevel,6);
 assert.equal(next.npcs.Mattew.rosterCareer[1].acquired,true);
 const before=structuredClone(next);
 syncFriendCareerSchedule(next);
 assert.deepEqual(next,before);
});
