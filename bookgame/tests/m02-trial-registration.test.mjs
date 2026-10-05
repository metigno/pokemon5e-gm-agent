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
const fixedNow=()=> "2026-10-05T19:25:00.000Z";

async function makeEngine(dice=new SequenceDice([1])){
  const bundle=await compileStory({scenesDir,modulesDir,ecologyOptions});
  const scenes={
    async load(id){const s=bundle.scenes[id]; if(!s) throw new Error("missing scene "+id); return structuredClone(s);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,dice,now:fixedNow}),bundle};
}

function stateAt(node="trial_desk"){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.world.flags.a2_rank_trial_e_d_available=true;
  s.competition.trials.RANK_E_TO_D={
    checkpointId:"RANK_E_TO_D",available:true,fromRank:"E",toRank:"D",
    requiredRosterSize:3,retryable:true,registered:false,registeredPokemonIds:[],
    attempts:0,bestResult:null,lastResult:null,completed:false,registeredAtMinutes:null
  };
  s.player.roster=[
    {id:"A",species:"Bulbasaur",level:5},
    {id:"B",species:"Charmander",level:5},
    {id:"C",species:"Squirtle",level:5},
    {id:"D",species:"Pikachu",level:5}
  ];
  s.world.locationId="borgo_salice_sala_verde";
  s.story.sceneId="m02-trial-registration"; s.story.nodeId=node;
  return s;
}

test("M2_12 compiles with expanded Official Three review",async()=>{
  const {bundle}=await makeEngine();
  const scene=bundle.scenes["m02-trial-registration"];
  for(const id of ["official_three_rules","roster_order_note","official_three_review","official_three_confirm","registered_three_review","retry_registration_rules","registration_withdrawal_note"]) assert.ok(scene.nodes[id],id);
});

test("M2_12 entry still requires Rank E and availability flag",async()=>{
  const {engine}=await makeEngine();
  const a=stateAt("trial_info"); a.competition.rank="D";
  await assert.rejects(()=>engine.present(a),/conditions are not satisfied/i);
  const b=stateAt("trial_info"); b.world.flags.a2_rank_trial_e_d_available=false;
  await assert.rejects(()=>engine.present(b),/conditions are not satisfied/i);
});

test("register_now opens review and does not lock immediately",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt();
  s=await engine.choose(s,"register_now");
  assert.equal(s.story.nodeId,"official_three_review");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
  assert.deepEqual(s.competition.trials.RANK_E_TO_D.registeredPokemonIds,[]);
});

test("roster check also reviews before locking",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("trial_roster_check");
  s=await engine.choose(s,"roster_ok_register");
  assert.equal(s.story.nodeId,"official_three_review");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
});

test("final confirmation locks exact first three identities",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("official_three_confirm");
  s=await engine.choose(s,"confirm_official_three");
  assert.equal(s.story.nodeId,"trial_registered");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,true);
  assert.deepEqual(s.competition.trials.RANK_E_TO_D.registeredPokemonIds,["A","B","C"]);
});

test("reconsidering before final confirmation leaves registration unlocked",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("official_three_confirm");
  s=await engine.choose(s,"confirm_reconsider");
  assert.equal(s.story.nodeId,"official_three_review");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
});

test("changing roster order before confirmation changes the legal proposed three",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("official_three_confirm");
  s.player.roster=[s.player.roster[3],s.player.roster[2],s.player.roster[1],s.player.roster[0]];
  s=await engine.choose(s,"confirm_official_three");
  assert.deepEqual(s.competition.trials.RANK_E_TO_D.registeredPokemonIds,["D","C","B"]);
});

test("insufficient roster cannot confirm Official Three",async()=>{
  const {engine}=await makeEngine();
  const s=stateAt("official_three_confirm");
  s.player.roster=s.player.roster.slice(0,2);
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="confirm_official_three"),false);
  await assert.rejects(()=>engine.choose(s,"confirm_official_three"),/not currently available/i);
});

test("rules explicitly distinguish identity lock from live condition",async()=>{
  const {bundle}=await makeEngine();
  const text=bundle.scenes["m02-trial-registration"].nodes.official_three_rules.stitches.map(x=>x.text).join(" ");
  assert.match(text,/identit/i);
  assert.match(text,/HP/);
  assert.match(text,/PP/);
  assert.match(text,/status/i);
  assert.match(text,/rifiutato/i);
});

test("registration uses normal roster ordering instead of second selection subsystem",async()=>{
  const {bundle}=await makeEngine();
  const text=bundle.scenes["m02-trial-registration"].nodes.roster_order_note.stitches.map(x=>x.text).join(" ");
  assert.match(text,/normale gestione del roster/i);
  assert.match(text,/non crea una selezione separata/i);
});

test("registered review can proceed to Trial only while registered",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("official_three_confirm");
  s=await engine.choose(s,"confirm_official_three");
  s.story.nodeId="registered_three_review";
  let v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="locked_to_trial"));
  s.competition.trials.RANK_E_TO_D.registered=false;
  v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="locked_to_trial"),false);
});

test("postpone before confirmation never registers a team",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("official_three_review");
  s=await engine.choose(s,"review_step_away");
  assert.equal(s.story.nodeId,"trial_postponed");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
});

test("retry rules state that a loss requires a new registration",async()=>{
  const {bundle}=await makeEngine();
  const text=bundle.scenes["m02-trial-registration"].nodes.retry_registration_rules.stitches.map(x=>x.text).join(" ");
  assert.match(text,/sconfitta chiude la registrazione/i);
  assert.match(text,/registrare di nuovo/i);
  assert.match(text,/trio diverso/i);
});

test("registration survives save/reload with exact identity list",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"m2-reg-save-"));
  try{
    const {engine}=await makeEngine();
    const store=new SaveStore(dir);
    let s=stateAt("official_three_confirm"); s.slot="m2-reg";
    s=await engine.choose(s,"confirm_official_three");
    await store.save(s);
    const loaded=await store.load("m2-reg");
    assert.equal(loaded.competition.trials.RANK_E_TO_D.registered,true);
    assert.deepEqual(loaded.competition.trials.RANK_E_TO_D.registeredPokemonIds,["A","B","C"]);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test("registration itself does not promote Rank",async()=>{
  const {engine}=await makeEngine();
  let s=stateAt("official_three_confirm");
  s=await engine.choose(s,"confirm_official_three");
  assert.equal(s.competition.rank,"E");
  assert.equal(s.competition.history.length,0);
});

test("Sala Verde trial access still creates canonical E→D trial state",async()=>{
  const {engine}=await makeEngine();
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.world.flags.a2_rank_trial_e_d_available=true;
  s.world.locationId="borgo_salice_sala_verde";
  s.story.sceneId="m02-borgo-salice"; s.story.nodeId="sala_verde";
  const next=await engine.choose(s,"trial_access");
  const t=next.competition.trials.RANK_E_TO_D;
  assert.equal(t.available,true);
  assert.equal(t.fromRank,"E");
  assert.equal(t.toRank,"D");
  assert.equal(t.requiredRosterSize,3);
  assert.equal(t.retryable,true);
});

test("A2_RANK_TRIAL_E_D remains level 4+ and Rank E",async()=>{
  const {bundle}=await makeEngine();
  const event=bundle.worldEvents.find(e=>e.id==="A2_RANK_TRIAL_E_D");
  const all=event.trigger.all;
  assert.equal(all.find(c=>c.path==="competition.rank").eq,"E");
  assert.equal(all.find(c=>c.path==="player.trainerLevel").gte,4);
});
