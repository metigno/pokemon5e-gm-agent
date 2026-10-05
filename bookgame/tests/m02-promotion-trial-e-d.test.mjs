import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookgameEngine } from "../src/engine/bookgame-engine.mjs";
import { compileStory } from "../src/compiler/story-compiler.mjs";
import { SaveStore } from "../src/engine/save-store.mjs";
import { createNewGameState } from "../src/engine/state.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-05T19:40:00.000Z";

async function makeEngine(dice=new SequenceDice([1])){
  const bundle=await compileStory({scenesDir,modulesDir,ecologyOptions});
  const scenes={
    async load(id){const s=bundle.scenes[id]; if(!s) throw new Error("missing scene "+id); return structuredClone(s);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,dice,now:fixedNow}),bundle};
}

function trialState(node="trial_gate_call"){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.player.roster=[
    {id:"A",species:"Bulbasaur",level:5,hp:{current:10,max:10}},
    {id:"B",species:"Charmander",level:5,hp:{current:10,max:10}},
    {id:"C",species:"Squirtle",level:5,hp:{current:10,max:10}},
    {id:"D",species:"Pikachu",level:5,hp:{current:10,max:10}}
  ];
  s.competition.trials.RANK_E_TO_D={
    checkpointId:"RANK_E_TO_D",available:true,fromRank:"E",toRank:"D",requiredRosterSize:3,
    retryable:true,registered:true,registeredAtMinutes:s.world.elapsedMinutes,
    registeredPokemonIds:["A","B","C"],attempts:0,bestResult:null,lastResult:null,completed:false
  };
  s.story.sceneId="m02-promotion-trial-e-d"; s.story.nodeId=node;
  s.world.locationId="borgo_salice_arena";
  return s;
}

test("M2_13 compiles at 17 nodes / 26 meaningful choices",async()=>{
  const {bundle}=await makeEngine();
  const scene=bundle.scenes["m02-promotion-trial-e-d"];
  assert.equal(Object.keys(scene.nodes).length,17);
  assert.equal(Object.values(scene.nodes).reduce((n,x)=>n+(x.choices?.length||0),0),26);
  assert.equal(scene.nodes.trial_combat_handoff.choices.length,0);
});

test("M2_13 entry still requires Rank E and a registered Trial",async()=>{
  const {engine}=await makeEngine();
  const a=trialState(); a.competition.rank="D";
  await assert.rejects(()=>engine.present(a),/conditions are not satisfied/i);
  const b=trialState(); b.competition.trials.RANK_E_TO_D.registered=false;
  await assert.rejects(()=>engine.present(b),/conditions are not satisfied/i);
});

test("arena gate offers public info, field inspection, check-in and withdrawal",async()=>{
  const {engine}=await makeEngine();
  const v=await engine.present(trialState());
  assert.deepEqual(new Set(v.choices.map(c=>c.id)),new Set(["official_check_in","review_public_board","inspect_field","withdraw_before_briefing"]));
});

test("public board exposes fixed Ines roster without scaling",async()=>{
  const {engine}=await makeEngine();
  let s=trialState();
  s=await engine.choose(s,"review_public_board");
  assert.equal(s.world.flags.trial_e_d_public_roster_reviewed,true);
  const v=await engine.present(s);
  assert.match(v.text,/Growlithe Lv5/);
  assert.match(v.text,/Roselia Lv5/);
  assert.match(v.text,/Sableye Lv4/);
  assert.match(v.text,/nessun livello viene adattato/i);
});

test("field inspection costs time and grants no mechanical buff",async()=>{
  const {engine}=await makeEngine();
  const s=trialState();
  const before=s.world.elapsedMinutes;
  const next=await engine.choose(s,"inspect_field");
  assert.equal(next.world.elapsedMinutes,before+5);
  assert.equal(next.world.flags.trial_e_d_field_inspected,true);
  assert.equal(Object.keys(next.world.flags).some(k=>/buff|bonus/i.test(k)),false);
});

test("neutrality explicitly rejects invisible modifiers",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("field_inspection");
  s=await engine.choose(s,"inspect_neutrality");
  const v=await engine.present(s);
  assert.match(v.text,/modificatori invisibili/i);
  assert.match(v.text,/scaling/i);
});

test("official check-in verifies registered identity, not current first three",async()=>{
  const {engine}=await makeEngine();
  let s=trialState();
  s.player.roster=[s.player.roster[3],s.player.roster[2],s.player.roster[1],s.player.roster[0]];
  s=await engine.choose(s,"official_check_in");
  s=await engine.choose(s,"verify_official_three");
  assert.equal(s.world.flags.trial_e_d_identity_verified,true);
  const v=await engine.present(s);
  assert.match(v.text,/riordino del roster non cambia le identità registrate/i);
});

test("rules preserve Singles 3 with no custom switching cost",async()=>{
  const {engine}=await makeEngine();
  const s=trialState("rules_format");
  const v=await engine.present(s);
  assert.match(v.text,/Singles/);
  assert.match(v.text,/tre Pokémon registrati/i);
  const sw=await engine.choose(s,"review_switching_rule");
  const swv=await engine.present(sw);
  assert.match(swv.text,/non viene aggiunto alcun costo custom/i);
});

test("status briefing grants no invented resistance or cure",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("rules_format");
  s=await engine.choose(s,"review_status_rule");
  const v=await engine.present(s);
  assert.match(v.text,/Nessuna immunità|bonus inventati|cure/i);
});

for(const [choice,value] of [["focus_field_control","field_control"],["focus_status","status"],["focus_switching","switching"]]){
  test("tactical focus "+value+" records preparation context only",async()=>{
    const {engine}=await makeEngine();
    let s=trialState("tactical_briefing");
    s=await engine.choose(s,choice);
    assert.equal(s.world.flags.trial_e_d_preparation_focus,value);
    assert.equal(s.competition.rank,"E");
    assert.equal(s.competition.activeMatch,null);
    assert.equal(s.pending,null);
  });
}

test("withdrawal before start consumes no Trial attempt",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("trial_ines_briefing");
  s=await engine.choose(s,"withdraw_before_start");
  assert.equal(s.story.sceneId,"m02-trial-registration");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,true);
  assert.equal(s.competition.trials.RANK_E_TO_D.attempts,0);
  assert.equal(s.pending,null);
});

test("begin_trial creates HARD Singles 3v3 handoff with fixed Ines",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("trial_ines_briefing");
  s=await engine.choose(s,"begin_trial");
  assert.equal(s.pending.type,"pokemon5e_combat");
  assert.equal(s.pending.encounterId,"A2_RANK_TRIAL_E_D");
  assert.equal(s.pending.competition.type,"promotion_trial");
  assert.equal(s.pending.competition.format,"Singles");
  assert.equal(s.pending.competition.officialRosterSize,3);
  assert.equal(s.pending.competition.difficulty,"HARD");
  assert.equal(s.pending.competition.opponentTrainerId,"SAL_GATE_E_D_INES_VARGA");
  assert.equal(s.pending.opponent.species,"Growlithe");
  assert.equal(s.pending.opponent.level,5);
  assert.deepEqual(s.pending.opponentBench.map(p=>[p.species,p.level]),[["Roselia",5],["Sableye",4]]);
});

test("begin_trial uses registered A/B/C after live roster reorder",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("trial_ines_briefing");
  s.player.roster=[s.player.roster[3],s.player.roster[2],s.player.roster[1],s.player.roster[0]];
  s=await engine.choose(s,"begin_trial");
  assert.equal(s.pending.playerPokemon.id,"A");
  assert.deepEqual(s.pending.playerBench.map(p=>p.id),["B","C"]);
});

test("begin_trial preserves current live condition of registered Pokémon",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("trial_ines_briefing");
  s.player.roster[0].hp.current=3;
  s=await engine.choose(s,"begin_trial");
  assert.equal(s.pending.playerPokemon.id,"A");
  assert.equal(s.pending.playerPokemon.hp.current,3);
});

test("missing registered Pokémon rejects entry without consuming attempt",async()=>{
  const {engine}=await makeEngine();
  const s=trialState("trial_ines_briefing");
  s.player.roster=s.player.roster.filter(p=>p.id!=="B");
  await assert.rejects(()=>engine.choose(s,"begin_trial"),/Registered Pokémon is unavailable.*B/);
  assert.equal(s.competition.trials.RANK_E_TO_D.attempts,0);
});

test("win resolves to Rank D and M2_14",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("trial_ines_briefing");
  s=await engine.choose(s,"begin_trial");
  s=engine.resolveCombatHandoff(s,"win");
  assert.equal(s.competition.rank,"D");
  assert.equal(s.story.sceneId,"m02-trial-result");
  assert.equal(s.story.nodeId,"trial_win");
});

test("loss remains Rank E and clears registration",async()=>{
  const {engine}=await makeEngine();
  let s=trialState("trial_ines_briefing");
  s=await engine.choose(s,"begin_trial");
  s=engine.resolveCombatHandoff(s,"lose");
  assert.equal(s.competition.rank,"E");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
  assert.deepEqual(s.competition.trials.RANK_E_TO_D.registeredPokemonIds,[]);
  assert.equal(s.story.nodeId,"trial_loss");
});

test("pending combat survives save/reload with registered identities",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"m2-trial-pending-"));
  try{
    const {engine}=await makeEngine();
    const store=new SaveStore(dir);
    let s=trialState("trial_ines_briefing"); s.slot="m2-pending";
    s=await engine.choose(s,"begin_trial");
    await store.save(s);
    const loaded=await store.load("m2-pending");
    assert.equal(loaded.pending.competition.checkpointId,"RANK_E_TO_D");
    assert.deepEqual(loaded.pending.playerBench.map(p=>p.id),["B","C"]);
    assert.deepEqual(loaded.competition.activeMatch.registeredPokemonIds,["A","B","C"]);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
