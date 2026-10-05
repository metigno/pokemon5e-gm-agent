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
import { registerTrial, setTrialAvailable } from "../src/engine/competition-state.mjs";
import { SequenceDice } from "../src/engine/dice.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-05T19:10:00.000Z";
const FINAL_STATES=["resolved","partial","ignored","escalated"];

async function makeEngine(dice=new SequenceDice([1])){
  const bundle=await compileStory({scenesDir,modulesDir,ecologyOptions});
  const scenes={
    async load(id){const s=bundle.scenes[id]; if(!s) throw new Error("missing scene "+id); return structuredClone(s);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,dice,now:fixedNow}),bundle};
}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.world.flags.m1_complete=true;
  s.world.flags.m02_unlocked=true;
  s.world.flags.m2_active=true;
  s.competition.rank="D";
  s.competition.rankOrder=2;
  s.world.locationId="borgo_salice_arena";
  s.story.sceneId="m02-trial-result";
  s.story.nodeId="trial_win";
  return s;
}

function winState(flags={}){
  const s=base();
  Object.assign(s.world.flags,flags);
  return s;
}

function full(state="resolved"){
  return {n_met:true,friend_beat_02_complete:true,network_outcome_complete:true,poaching_network_state:state};
}

function lossState(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.world.flags.m1_complete=true;
  s.world.flags.m02_unlocked=true;
  s.world.flags.m2_active=true;
  s.competition.rank="E";
  s.competition.rankOrder=1;
  s.competition.trials.RANK_E_TO_D={
    checkpointId:"RANK_E_TO_D",available:true,fromRank:"E",toRank:"D",
    requiredRosterSize:3,retryable:true,registered:false,registeredPokemonIds:[],
    attempts:1,lastResult:"lose",bestResult:"lose",completed:false
  };
  s.story.sceneId="m02-trial-result";
  s.story.nodeId="trial_loss";
  s.world.locationId="borgo_salice_arena";
  return s;
}

test("M2_14 compiles with no M3 scene target",async()=>{
  const {bundle}=await makeEngine();
  const scene=bundle.scenes["m02-trial-result"];
  assert.ok(scene);
  assert.equal(JSON.stringify(scene).includes("m03-handoff"),false);
  assert.equal(bundle.scenes["m03-handoff"],undefined);
});

test("M2_14 has expanded real-state nodes",async()=>{
  const {bundle}=await makeEngine();
  const nodes=Object.keys(bundle.scenes["m02-trial-result"].nodes);
  for(const id of ["trial_win","win_record_review","rank_d_access_review","m2_contract_review","m2_pending_items","pending_network_route","pending_n_route","pending_friend_route","m2_exit_confirmed","completed_state_review","trial_loss","loss_record_review","loss_roster_condition","loss_retry_options"]) assert.ok(nodes.includes(id),id);
});

test("A: missing poaching_network_state never closes even when callback=true",async()=>{
  const {engine}=await makeEngine();
  const s=winState({n_met:true,friend_beat_02_complete:true,network_outcome_complete:true});
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),false);
  assert.equal(v.choices.some(c=>c.id==="review_m2_pending"),true);
});

test("B: non-final intervened state never closes even when callback=true",async()=>{
  const {engine}=await makeEngine();
  const s=winState({...full(),poaching_network_state:"intervened"});
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),false);
});

for(const networkState of FINAL_STATES){
  test("final network state "+networkState+" satisfies exit contract",async()=>{
    const {engine}=await makeEngine();
    const s=winState(full(networkState));
    const v=await engine.present(s);
    assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),true);
    const next=await engine.choose(s,"complete_m2_exit");
    assert.equal(next.world.flags.m2_complete,true);
    assert.equal(next.world.flags.m03_unlocked,true);
    assert.equal(next.competition.rank,"D");
  });
}

test("missing N blocks completion while Rank D persists",async()=>{
  const {engine}=await makeEngine();
  const s=winState({friend_beat_02_complete:true,network_outcome_complete:true,poaching_network_state:"resolved"});
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),false);
  const pending=await engine.choose(s,"review_m2_pending");
  assert.equal(pending.competition.rank,"D");
  assert.equal(pending.world.flags.m03_unlocked,undefined);
  assert.equal(pending.story.nodeId,"m2_pending_items");
  const pv=await engine.present(pending);
  assert.ok(pv.choices.some(c=>c.id==="find_n_pending"));
});

test("missing Friend Beat blocks completion",async()=>{
  const {engine}=await makeEngine();
  const s=winState({n_met:true,network_outcome_complete:true,poaching_network_state:"partial"});
  const pending=await engine.choose(s,"review_m2_pending");
  const pv=await engine.present(pending);
  assert.ok(pv.choices.some(c=>c.id==="finish_friend_beat"));
  assert.equal(pending.world.flags.m03_unlocked,undefined);
});

test("rank E can never close M2 even with all narrative requirements",async()=>{
  const {engine}=await makeEngine();
  const s=winState(full("resolved"));
  s.competition.rank="E"; s.competition.rankOrder=1;
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),false);
});

test("Rank D pending routes can legally return to Borgo Salice",async()=>{
  const {engine}=await makeEngine();
  let s=winState({friend_beat_02_complete:true,network_outcome_complete:true,poaching_network_state:"resolved"});
  s=await engine.choose(s,"review_m2_pending");
  s=await engine.choose(s,"find_n_pending");
  s=await engine.choose(s,"n_route_hub");
  assert.equal(s.story.sceneId,"m02-borgo-salice");
  assert.equal(s.competition.rank,"D");
  const v=await engine.present(s);
  assert.ok(v);
});

test("Rank D pending N scene accepts legal continuation",async()=>{
  const {engine}=await makeEngine();
  const s=winState({friend_beat_02_complete:true,poaching_network_state:"resolved",mistwood_entry_complete:true,capture_signs_noticed:true});
  s.story.sceneId="m02-n-enters"; s.story.nodeId="zorua_encounter";
  const v=await engine.present(s);
  assert.ok(v);
});

test("Rank D pending Friend Beat scene accepts legal continuation",async()=>{
  const {engine}=await makeEngine();
  const s=winState({n_met:true,poaching_network_state:"resolved",friends_split:true,a2_friend_news_available:true,friend_beat_02_friend_id:"Daniel"});
  s.story.sceneId="m02-friend-beat-02"; s.story.nodeId="friend_news_arrive";
  const v=await engine.present(s);
  assert.ok(v);
});

test("completion is idempotent on re-entry",async()=>{
  const {engine}=await makeEngine();
  let s=winState(full("ignored"));
  s=await engine.choose(s,"complete_m2_exit");
  const historyLen=s.story.history.length;
  s.story.nodeId="trial_win";
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),false);
  assert.equal(v.choices.some(c=>c.id==="review_completed_m2"),true);
  assert.equal(s.world.flags.m2_complete,true);
  assert.equal(s.world.flags.m03_unlocked,true);
  assert.equal(s.story.history.length,historyLen);
});

test("loss state explicitly has registration cleared and retry available",async()=>{
  const {engine}=await makeEngine();
  const s=lossState();
  const v=await engine.present(s);
  assert.equal(s.competition.rank,"E");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
  assert.ok(v.choices.some(c=>c.id==="retry_options"));
});

test("loss retry requires a new registration",async()=>{
  const {engine}=await makeEngine();
  let s=lossState();
  s=await engine.choose(s,"retry_options");
  s=await engine.choose(s,"retry_trial");
  assert.equal(s.story.sceneId,"m02-trial-registration");
  assert.equal(s.story.nodeId,"trial_desk");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
});

test("loss route preserves existing world state",async()=>{
  const {engine}=await makeEngine();
  let s=lossState();
  s.world.flags.n_met=true;
  s.world.flags.local_problem_started=true;
  s=await engine.choose(s,"back_to_borough_loss");
  assert.equal(s.world.flags.n_met,true);
  assert.equal(s.world.flags.local_problem_started,true);
  assert.equal(s.competition.rank,"E");
});

test("actual Trial loss clears registration and keeps attempt in history",async()=>{
  const {engine}=await makeEngine();
  let s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.player.roster=[
    {id:"A",species:"Bulbasaur",level:5},
    {id:"B",species:"Charmander",level:5},
    {id:"C",species:"Squirtle",level:5}
  ];
  setTrialAvailable(s,{checkpointId:"RANK_E_TO_D",fromRank:"E",toRank:"D",requiredRosterSize:3,retryable:true});
  registerTrial(s,{checkpointId:"RANK_E_TO_D"});
  s.story.sceneId="m02-promotion-trial-e-d"; s.story.nodeId="trial_ines_briefing";
  s.world.locationId="borgo_salice_arena";
  s=await engine.choose(s,"begin_trial");
  s=engine.resolveCombatHandoff(s,"lose");
  assert.equal(s.competition.rank,"E");
  assert.equal(s.competition.trials.RANK_E_TO_D.registered,false);
  assert.deepEqual(s.competition.trials.RANK_E_TO_D.registeredPokemonIds,[]);
  assert.equal(s.competition.history.at(-1).outcome,"lose");
  assert.deepEqual(s.competition.history.at(-1).registeredPokemonIds,["A","B","C"]);
});

test("actual Trial win promotes to D but does not unlock M3 when N is missing",async()=>{
  const {engine}=await makeEngine();
  let s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.world.flags.m1_complete=true; s.world.flags.m02_unlocked=true; s.world.flags.m2_active=true;
  s.competition.rank="E"; s.competition.rankOrder=1;
  s.player.roster=[{id:"A",species:"Bulbasaur",level:5},{id:"B",species:"Charmander",level:5},{id:"C",species:"Squirtle",level:5}];
  setTrialAvailable(s,{checkpointId:"RANK_E_TO_D",fromRank:"E",toRank:"D",requiredRosterSize:3,retryable:true});
  registerTrial(s,{checkpointId:"RANK_E_TO_D"});
  s.story.sceneId="m02-promotion-trial-e-d"; s.story.nodeId="trial_ines_briefing";
  s.world.locationId="borgo_salice_arena";
  s=await engine.choose(s,"begin_trial");
  s=engine.resolveCombatHandoff(s,"win");
  assert.equal(s.competition.rank,"D");
  s.world.flags.friend_beat_02_complete=true;
  s.world.flags.poaching_network_state="resolved";
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="complete_m2_exit"),false);
  assert.equal(s.world.flags.m03_unlocked,undefined);
});

test("save/reload preserves completed M2 and Rank D",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"m2-final-save-"));
  try{
    const {engine}=await makeEngine();
    const store=new SaveStore(dir);
    let s=winState(full("escalated")); s.slot="m2-final";
    s=await engine.choose(s,"complete_m2_exit");
    await store.save(s);
    const loaded=await store.load("m2-final");
    assert.equal(loaded.world.flags.m2_complete,true);
    assert.equal(loaded.world.flags.m03_unlocked,true);
    assert.equal(loaded.competition.rank,"D");
    assert.equal(loaded.world.flags.poaching_network_state,"escalated");
  } finally { await rm(dir,{recursive:true,force:true}); }
});
