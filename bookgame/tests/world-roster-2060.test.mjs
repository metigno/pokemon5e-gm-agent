import test from "node:test";
import assert from "node:assert/strict";
import { createNewGameState } from "../src/engine/state.mjs";
import { applyFriendCareerModuleMilestone } from "../src/engine/npc-career-scheduler.mjs";
import { openWorldGroupStage, prepareWorldGroupMatch } from "../src/engine/competition-state.mjs";
import { WORLD_2060_SPECIES, canonicalWorldTeam, pokemon5eWorldSpeciesDescriptor } from "../src/rules/world-roster-2060.mjs";
import { Poke5eDataRepository } from "../src/combat/poke5e-data.mjs";

function groupState() {
  const s=createNewGameState({protagonist:"Luke"});
  const names=[["c2060_01_luke","Luke"],["c2060_09_red","Red"],
    ["c2060_02_mattew","Mattew"],["c2060_26_astrid_vahl","Astrid Vahl"]];
  const field=names.map(([id,name])=>({id,name}));
  const w=s.competition.world;
  w.drawComplete=true;w.fieldLocked=true;w.field=field;w.groups={A:field};
  w.playerGroup="A";w.playerOpponents=field.slice(1);w.seedOrder=field;
  s.world.flags.world_qualified=true;
  return s;
}
function meta(worldOpponentIndex) {
  return {matchId:"WORLD_GROUP_MD"+(worldOpponentIndex+1),
    type:"official_match",format:"Singles",officialRosterSize:6,
    difficulty:"ELITE",worldOpponentIndex};
}
test("all 35 named World entrants have a fixed canonical six and no game transformations",()=>{
  assert.equal(Object.keys(WORLD_2060_SPECIES).length,35);
  for(const [name,species] of Object.entries(WORLD_2060_SPECIES)){
    assert.equal(species.length,6,name);
    const team=canonicalWorldTeam(name,{trainerId:name});
    assert.equal(team.length,6,name);
    assert.ok(team.every(p=>p.level===20 && p.source==="canonical_2060_species"),name);
    assert.ok(team.every(p=>!/(Mega|Gigamax|Dynamax|Alpha)/.test(p.species)),name);
  }
  assert.deepEqual(pokemon5eWorldSpeciesDescriptor("Arcanine di Hisui Alpha"),{species:"Arcanine",form:"Hisuian"});
  assert.deepEqual(pokemon5eWorldSpeciesDescriptor("Mega Rayquaza"),{species:"Rayquaza"});
  assert.deepEqual(pokemon5eWorldSpeciesDescriptor("Kyurem-Black"),{species:"Kyurem",form:"Black"});
  assert.deepEqual(pokemon5eWorldSpeciesDescriptor("Giratina-Origin"),{species:"Giratina",form:"Origin Forme"});
  assert.deepEqual(pokemon5eWorldSpeciesDescriptor("Zygarde"),{species:"Zygarde",form:"50% Forme"});
});
test("Red uses Charizard and five actual teammates, not old Growlithe proxies",()=>{
  const s=groupState();openWorldGroupStage(s);
  const {roster}=prepareWorldGroupMatch(s,meta(0));
  assert.deepEqual(roster.map(p=>p.species),
    ["Charizard","Jolteon","Lapras","Dodrio","Deoxys","Scizor"]);
  assert.deepEqual(s.competition.world.canonicalRosters.c2060_09_red,roster);
  s.competition.world.groupStage.opponentRosters.c2060_09_red=
    Array.from({length:6},(_,i)=>({species:"Eevee",level:20,rosterIndex:i,source:"persistent_regulated_world_roster"}));
  assert.deepEqual(prepareWorldGroupMatch(s,meta(0)).roster.map(p=>p.species),
    ["Charizard","Jolteon","Lapras","Dodrio","Deoxys","Scizor"]);
});
test("Mattew uses the persistent NPC six with real module levels and IDs",()=>{
  const s=groupState();
  for(const m of ["M01","M02","M03","M04","M05","M06","M07","M08","M09"]){
    applyFriendCareerModuleMilestone(s,m);
  }
  s.world.flags.m8_complete=true;
  s.world.flags.m9_active=true;
  const saved=[...s.npcs.Mattew.rosterCareer].sort((a,b)=>a.slot-b.slot);
  assert.ok(saved.every(p=>p.acquired));
  openWorldGroupStage(s);
  const {roster}=prepareWorldGroupMatch(s,meta(1));
  assert.deepEqual(roster.map(p=>p.level),saved.map(p=>p.pokemonLevel));
  assert.deepEqual(roster.map(p=>p.careerPokemonId),saved.map(p=>p.id));
  assert.deepEqual(roster.map(p=>p.species),
    ["Jolteon","Infernape","Gardevoir","Swampert","Corviknight","Zacian"]);
  assert.deepEqual(structuredClone(s).competition.world.canonicalRosters.c2060_02_mattew,roster);
});
test("unacquired Five team cannot be replaced by made-up Lv20 opponents",()=>{
  const s=groupState();
  assert.throws(()=>canonicalWorldTeam("Mattew",{npc:s.npcs.Mattew,trainerId:"c2060_02_mattew"}),
    /full persistent roster/);
});
test("every World species resolves against the actual offline Pokémon 5e 2024 pack",async()=>{
  const data=new Poke5eDataRepository();
  const missing=[];
  for(const name of Object.keys(WORLD_2060_SPECIES)){
    for(const pokemon of canonicalWorldTeam(name,{trainerId:name})){
      try {
        const species=await data.getSpecies(pokemon);
        assert.ok(species.id, name);
      } catch(error) {
        missing.push(name+": "+pokemon.species+(pokemon.form?" ("+pokemon.form+")":"")+" - "+error.message);
      }
    }
  }
  assert.deepEqual(missing,[]);
});
