import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { acquireCareerPokemon,evolveCareerPokemon } from "../src/engine/npc-roster-progression.mjs";

test("only the first canonical partner is owned in M1",()=>{
 const s=createNewGameState({protagonist:"Luke"});
 for(const name of ["Mattew","Daniel","Edward","Fab"]){
  assert.equal(s.npcs[name].rosterCareer.length,6);
  assert.equal(s.npcs[name].rosterCareer[0].acquired,true);
  assert.equal(s.npcs[name].rosterCareer.slice(1).every(p=>!p.acquired),true);
 }
});

test("Luke uses the same career roster when Luke is an NPC",()=>{
 const s=createNewGameState({protagonist:"Mattew"});
 const luke=s.npcs.Luke;
 assert.deepEqual(luke.rosterCareer[0].evolutionLine,["Growlithe-Hisui","Arcanine-Hisui"]);
 assert.equal(luke.rosterCareer[0].species,"Growlithe-Hisui");
 assert.equal(luke.rosterCareer[0].pokemonLevel,5);
 assert.equal(luke.rosterCareer[1].acquired,false);
});

test("career Pokemon cannot appear without an acquisition event",()=>{
 const s=createNewGameState({protagonist:"Luke"}); const m=s.npcs.Mattew;
 assert.throws(()=>acquireCareerPokemon(m,2,{pokemonLevel:6}),/story event/i);
 acquireCareerPokemon(m,2,{pokemonLevel:6,storyEventId:"M03_CATCH_01"});
 assert.equal(m.rosterCareer[1].acquired,true);
});

test("evolution requires external Pokemon 5e legality confirmation",()=>{
 const s=createNewGameState({protagonist:"Luke"}); const d=s.npcs.Daniel;
 assert.throws(()=>evolveCareerPokemon(d,1,{toSpecies:"Haunter",pokemonLevel:7}),/not satisfied/i);
 evolveCareerPokemon(d,1,{toSpecies:"Haunter",pokemonLevel:7,requirementsSatisfied:true,storyEventId:"DANIEL_GASTLY_EVOLVE"});
 assert.equal(d.rosterCareer[0].species,"Haunter");
 assert.equal(d.rosterCareer[0].evolutionHistory.length,1);
});

test("NPC cannot skip an evolution stage",()=>{
 const s=createNewGameState({protagonist:"Luke"}); const e=s.npcs.Edward;
 assert.throws(()=>evolveCareerPokemon(e,1,{toSpecies:"Feraligatr",pokemonLevel:14,requirementsSatisfied:true}),/canonical career line/i);
});
