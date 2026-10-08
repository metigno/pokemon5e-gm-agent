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

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const eventsDir=fileURLToPath(new URL("../content/events/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-06T11:30:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function roster6(){
  return [
    {speciesId:"growlithe",name:"Growlithe",level:16},
    {speciesId:"venusaur",name:"Venusaur",level:16},
    {speciesId:"gyarados",name:"Gyarados",level:16},
    {speciesId:"jolteon",name:"Jolteon",level:16},
    {speciesId:"snorlax",name:"Snorlax",level:16},
    {speciesId:"noctowl",name:"Noctowl",level:16}
  ];
}

function baseA(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.player.trainerLevel=16;
  s.player.roster=roster6();
  s.competition.rank="A";
  s.competition.rankOrder=5;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,
    m06_unlocked:true,m6_active:true,red_met:true,friend_beat_06_complete:true,
    ancient_mystery_layer_2:"cross_region_pattern",m6_ancient_layer_two_complete:true,
    m6_lighthouse_return_ready:true
  });
  s.world.locationId="interregional_archive";
  return s;
}

async function registerAS(engine,s){
  s.world.flags.m6_first_lighthouse_return_complete=true;
  s.story.sceneId="m06-trial-registration";
  s.story.nodeId="eligibility_audit";
  s=await engine.choose(s,"audit_sync");
  s=await engine.choose(s,"desk_register");
  return s;
}

test("M6 final event bindings compile including cutoff and outcome window",async()=>{
  const {bundle}=await makeEngine();
  const ids=new Set(bundle.worldEvents.map(e=>e.id));
  for(const id of ["A6_RANK_TRIAL_A_S","A6_CUTOFF","M6_MODULE_OUTCOME_WINDOW"]) assert.ok(ids.has(id),id);
});

test("M6_10 coastal return consumes real time and does not promote",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();
  s.story.sceneId="m06-first-lighthouse-return";s.story.nodeId="return_entry";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"return_routes");
  s=await engine.choose(s,"route_coast");
  s=await engine.choose(s,"coast_travel");
  assert.equal(s.world.elapsedMinutes-before,180);
  assert.equal(s.world.flags.m6_lighthouse_route,"coast");
  assert.equal(s.competition.rank,"A");
});

test("M6_10 closes the real Faro return without granting Rank S",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();
  s.story.sceneId="m06-first-lighthouse-return";s.story.nodeId="close";
  s=await engine.choose(s,"close_trial");
  assert.equal(s.world.flags.m6_first_lighthouse_return_complete,true);
  assert.equal(s.world.locationId,"far_ruins");
  assert.equal(s.competition.rank,"A");
});

test("M6_10 exposes the authored M7 handoff only after M6 completion",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();
  s.story.sceneId="m06-first-lighthouse-return";s.story.nodeId="ruins_boundary";
  let view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="advance_m7_handoff"),false);
  s.competition.rank="S";
  s.competition.rankOrder=6;
  s.world.locationId="far_ruins";
  s.world.flags.m6_complete=true;
  s.world.flags.m07_unlocked=true;
  view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="advance_m7_handoff"));
  s=await engine.choose(s,"advance_m7_handoff");
  assert.equal(s.story.sceneId,"m07-handoff");
  assert.equal(s.story.nodeId,"m07_entry");
  assert.equal(s.world.locationId,"far_ruins");
  assert.equal(s.competition.rank,"S");
});

test("M6_11 syncs canonical RANK_A_TO_S and registers an Official Six",async()=>{
  const {engine}=await makeEngine();
  let s=await registerAS(engine,baseA());
  assert.equal(s.competition.trials.RANK_A_TO_S.available,true);
  assert.equal(s.competition.trials.RANK_A_TO_S.registered,true);
  assert.equal(s.competition.trials.RANK_A_TO_S.requiredRosterSize,6);
  assert.equal(s.competition.rank,"A");
});

test("M6_11 hides registration with fewer than six Pokémon",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();s.world.flags.m6_first_lighthouse_return_complete=true;s.player.roster=s.player.roster.slice(0,5);
  s.story.sceneId="m06-trial-registration";s.story.nodeId="eligibility_audit";
  s=await engine.choose(s,"audit_sync");
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="desk_register"),false);
  assert.ok(v.choices.some(c=>c.id==="desk_roster"));
});

test("M6_12 Gate del Faro is fixed six-on-six ELITE promotion metadata",async()=>{
  const {bundle}=await makeEngine();
  const ch=bundle.scenes["m06-promotion-trial-a-s"].nodes.battle_handoff.choices[0];
  assert.equal(ch.combat.competition.type,"promotion_trial");
  assert.equal(ch.combat.competition.checkpointId,"RANK_A_TO_S");
  assert.equal(ch.combat.competition.officialRosterSize,6);
  assert.equal(ch.combat.competition.difficulty,"ELITE");
  assert.equal(ch.combat.opponent.level,15);
  assert.equal(ch.combat.opponentBench.length,5);
});

test("M6_12 real Trial win promotes only through E5 to Rank S",async()=>{
  const {engine}=await makeEngine();
  let s=await registerAS(engine,baseA());
  s.story.sceneId="m06-promotion-trial-a-s";s.story.nodeId="battle_handoff";
  s=await engine.choose(s,"fight_trial_a_s");
  s=engine.resolveCombatHandoff(s,"win");
  assert.equal(s.competition.rank,"S");
  assert.equal(s.competition.rankOrder,6);
  assert.equal(s.competition.trials.RANK_A_TO_S.completed,true);
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M6_12 real Trial loss preserves Rank A and reopens retry",async()=>{
  const {engine}=await makeEngine();
  let s=await registerAS(engine,baseA());
  s.story.sceneId="m06-promotion-trial-a-s";s.story.nodeId="battle_handoff";
  s=await engine.choose(s,"fight_trial_a_s");
  s=engine.resolveCombatHandoff(s,"lose");
  assert.equal(s.competition.rank,"A");
  assert.equal(s.competition.trials.RANK_A_TO_S.available,true);
  assert.equal(s.competition.trials.RANK_A_TO_S.registered,false);
  assert.equal(s.competition.trials.RANK_A_TO_S.attempts,1);
});

test("A6_CUTOFF freezes Rank S when Rank S exists at deadline",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();s.player.trainerLevel=17;s.competition.rank="S";s.competition.rankOrder=6;
  s.story.sceneId="m06-world-cutoff";s.story.nodeId="pending";
  s=await engine.choose(s,"pending_wait");
  assert.equal(s.world.flags.world_cutoff_state,"rank_s_at_cutoff");
  assert.equal(s.world.flags.world_cutoff_complete,true);
});

test("A6_CUTOFF preserves a late Rank A snapshot instead of rewriting it later",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();s.player.trainerLevel=17;
  s.story.sceneId="m06-world-cutoff";s.story.nodeId="pending";
  s=await engine.choose(s,"pending_wait");
  assert.equal(s.world.flags.world_cutoff_state,"rank_a_at_cutoff");
  s.competition.rank="S";s.competition.rankOrder=6;
  s.story.nodeId="current_status";
  const v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="status_a"));
  assert.equal(s.world.flags.world_cutoff_state,"rank_a_at_cutoff");
});

test("M6_13 review records cutoff consumption without changing frozen state",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();s.competition.rank="S";s.competition.rankOrder=6;
  Object.assign(s.world.flags,{world_cutoff_state:"rank_s_at_cutoff",world_cutoff_complete:true,m6_first_lighthouse_return_complete:true});
  s.story.sceneId="m06-world-cutoff";s.story.nodeId="freeze_confirm";
  s=await engine.choose(s,"freeze_record");
  s=await engine.choose(s,"record_gate");
  assert.equal(s.world.flags.m6_world_cutoff_review_complete,true);
  assert.equal(s.world.flags.world_cutoff_state,"rank_s_at_cutoff");
  assert.equal(s.world.flags.m6_module_outcome_available,true);
});

test("M6_14 strict exit contract rejects a forged outcome with missing Ancient Layer Two",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();s.competition.rank="S";s.competition.rankOrder=6;
  Object.assign(s.world.flags,{world_cutoff_state:"rank_s_at_cutoff",m6_world_cutoff_review_complete:true,m6_first_lighthouse_return_complete:true,m6_module_outcome_available:true});
  delete s.world.flags.ancient_mystery_layer_2;
  s.story.sceneId="m06-module-outcome";s.story.nodeId="outcome_entry";
  await assert.rejects(()=>engine.present(s),/Scene conditions/);
});

test("M6_14 closes M6 and unlocks M7 without World qualification or state reset",async()=>{
  const {engine}=await makeEngine();
  let s=baseA();s.competition.rank="S";s.competition.rankOrder=6;
  Object.assign(s.world.flags,{world_cutoff_state:"rank_s_at_cutoff",world_cutoff_complete:true,m6_world_cutoff_review_complete:true,m6_first_lighthouse_return_complete:true,m6_module_outcome_available:true});
  s.player.inventory=["poke-ball","potion"];
  const roster=structuredClone(s.player.roster),inventory=structuredClone(s.player.inventory);
  s.story.sceneId="m06-module-outcome";s.story.nodeId="contract_audit";
  s=await engine.choose(s,"audit_complete");
  assert.equal(s.world.flags.m6_complete,true);
  assert.equal(s.world.flags.m07_unlocked,true);
  assert.equal(s.world.flags.m6_outcome_complete,true);
  assert.equal(s.world.flags.world_qualified,undefined);
  assert.equal(s.competition.rank,"S");
  assert.deepEqual(s.player.roster,roster);
  assert.deepEqual(s.player.inventory,inventory);
});

test("M6 final state survives save/reload",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m6c3-"));
    const store=new SaveStore(dir);
    const {engine}=await makeEngine();
    let s=baseA();s.competition.rank="S";s.competition.rankOrder=6;
    Object.assign(s.world.flags,{world_cutoff_state:"rank_s_at_cutoff",world_cutoff_complete:true,m6_world_cutoff_review_complete:true,m6_first_lighthouse_return_complete:true,m6_module_outcome_available:true});
    s.story.sceneId="m06-module-outcome";s.story.nodeId="contract_audit";
    s=await engine.choose(s,"audit_complete");
    s.slot="slot1";await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.m07_unlocked,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
