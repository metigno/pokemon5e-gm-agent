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
const fixedNow=()=> "2026-10-06T08:30:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function roster5(){
  return [
    {speciesId:"growlithe",name:"Growlithe",level:13},
    {speciesId:"roselia",name:"Roselia",level:13},
    {speciesId:"chinchou",name:"Chinchou",level:13},
    {speciesId:"sableye",name:"Sableye",level:13},
    {speciesId:"noctowl",name:"Noctowl",level:13}
  ];
}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.player.trainerLevel=14;
  s.player.roster=roster5();
  s.competition.rank="B";
  s.competition.rankOrder=4;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,
    m05_unlocked:true,m5_active:true,fulgore_visited:true,
    friend_beat_05_complete:true,interregional_license:true,lance_met:true,
    ancient_mystery_layer_1:"partial_unresolved_trace",
    m5_high_altitude_event_available:true,a5_rank_trial_b_a_available:true
  });
  s.world.locationId="alt_town";
  return s;
}

async function registerBA(engine,s){
  s.story.sceneId="m05-trial-registration";
  s.story.nodeId="eligibility_audit";
  s=await engine.choose(s,"audit_sync");
  s=await engine.choose(s,"desk_register");
  return s;
}

test("M5_10-M5_14 lock exactly 83 logical nodes and 181 meaningful choices",async()=>{
  const {bundle}=await makeEngine();
  const ids=["m05-high-altitude-event","m05-trial-registration","m05-promotion-trial-b-a","m05-masters-entry","m05-module-outcome"];
  const nodes=ids.reduce((n,id)=>n+Object.keys(bundle.scenes[id].nodes).length,0);
  const choices=ids.reduce((n,id)=>n+Object.values(bundle.scenes[id].nodes).reduce((s,node)=>s+(node.choices?.length??0),0),0);
  assert.equal(nodes,83);
  assert.equal(choices,181);
});

test("M5 final event windows compile",async()=>{
  const {bundle}=await makeEngine();
  const ids=new Set(bundle.worldEvents.map(e=>e.id));
  for(const id of ["M5_HIGH_ALTITUDE_WINDOW","A5_RANK_TRIAL_B_A","A5_MASTERS_ENTRY","M5_MODULE_OUTCOME_WINDOW"])assert.ok(ids.has(id));
});

test("M5_10 report-only support closes the incident without changing Rank",async()=>{
  const {engine}=await makeEngine();let s=base();
  s.story.sceneId="m05-high-altitude-event";s.story.nodeId="event_entry";
  s=await engine.choose(s,"entry_report");
  s=await engine.choose(s,"responder_only");
  s=await engine.choose(s,"report_resolve");
  s=await engine.choose(s,"supported_record");
  assert.equal(s.world.flags.m5_high_altitude_event_result,"supported_response");
  assert.equal(s.world.flags.m5_high_altitude_event_complete,true);
  assert.equal(s.competition.rank,"B");
});

test("M5_11 syncs canonical RANK_B_TO_A and registers an Official Five",async()=>{
  const {engine}=await makeEngine();let s=base();
  s=await registerBA(engine,s);
  assert.equal(s.competition.trials.RANK_B_TO_A.available,true);
  assert.equal(s.competition.trials.RANK_B_TO_A.registered,true);
  assert.equal(s.competition.trials.RANK_B_TO_A.requiredRosterSize,5);
  assert.equal(s.competition.rank,"B");
});

test("M5_11 hides registration when roster has fewer than five Pokémon",async()=>{
  const {engine}=await makeEngine();let s=base();s.player.roster=s.player.roster.slice(0,4);
  s.story.sceneId="m05-trial-registration";s.story.nodeId="eligibility_audit";
  s=await engine.choose(s,"audit_sync");
  const v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="desk_register"),false);
  assert.ok(v.choices.some(c=>c.id==="desk_roster"));
});

test("M5_12 fixed B-A Trial is five-on-five gate metadata with no scaling",async()=>{
  const {bundle}=await makeEngine();
  const ch=bundle.scenes["m05-promotion-trial-b-a"].nodes.battle_handoff.choices[0];
  assert.equal(ch.combat.competition.type,"promotion_trial");
  assert.equal(ch.combat.competition.checkpointId,"RANK_B_TO_A");
  assert.equal(ch.combat.competition.officialRosterSize,5);
  assert.equal(ch.combat.competition.difficulty,"ELITE");
  assert.equal(ch.combat.opponent.level,13);
  assert.equal(ch.combat.opponentBench.length,4);
});

test("M5_12 real Trial win promotes through E5 to Rank A",async()=>{
  const {engine}=await makeEngine();let s=await registerBA(engine,base());
  s.story.sceneId="m05-promotion-trial-b-a";s.story.nodeId="battle_handoff";
  s=await engine.choose(s,"fight_trial");
  assert.equal(s.pending.competition.checkpointId,"RANK_B_TO_A");
  s=engine.resolveCombatHandoff(s,"win");
  assert.equal(s.competition.rank,"A");
  assert.equal(s.competition.rankOrder,5);
  assert.equal(s.competition.trials.RANK_B_TO_A.completed,true);
  assert.equal(s.competition.trials.RANK_B_TO_A.available,false);
});

test("M5_12 real Trial loss preserves Rank B and reopens retry",async()=>{
  const {engine}=await makeEngine();let s=await registerBA(engine,base());
  s.story.sceneId="m05-promotion-trial-b-a";s.story.nodeId="battle_handoff";
  s=await engine.choose(s,"fight_trial");
  s=engine.resolveCombatHandoff(s,"lose");
  assert.equal(s.competition.rank,"B");
  assert.equal(s.competition.trials.RANK_B_TO_A.available,true);
  assert.equal(s.competition.trials.RANK_B_TO_A.registered,false);
  assert.equal(s.competition.trials.RANK_B_TO_A.attempts,1);
});

test("A5_MASTERS_ENTRY opens only after actual Rank A plus level or invitation",async()=>{
  const {engine}=await makeEngine();let s=await registerBA(engine,base());
  s.story.sceneId="m05-promotion-trial-b-a";s.story.nodeId="battle_handoff";
  s=await engine.choose(s,"fight_trial");
  s=engine.resolveCombatHandoff(s,"win");
  assert.equal(s.world.flags.a5_masters_entry_available,undefined);
  s=await engine.choose(s,"win_masters");
  assert.equal(s.world.flags.a5_masters_entry_available,true);
});

test("M5_13 Masters loss changes seeding state but never removes Rank A",async()=>{
  const {engine}=await makeEngine();let s=base();
  s.competition.rank="A";s.competition.rankOrder=5;
  s.world.flags.a5_masters_entry_available=true;
  s.world.flags.masters_entry_registration_complete=true;
  s.story.sceneId="m05-masters-entry";s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_masters_entry");
  s=engine.resolveCombatHandoff(s,"lose");
  s=await engine.choose(s,"loss_seed");
  s=await engine.choose(s,"open_record");
  assert.equal(s.competition.rank,"A");
  assert.equal(s.world.flags.masters_entry_result,"loss");
  assert.equal(s.world.flags.masters_seed_band,"open_entry");
  assert.equal(s.world.flags.masters_entry_complete,true);
});

test("M5_13 Masters win records high seeding and not a geographic unlock",async()=>{
  const {engine}=await makeEngine();let s=base();
  s.competition.rank="A";s.competition.rankOrder=5;
  s.world.flags.a5_masters_entry_available=true;
  s.world.flags.masters_entry_registration_complete=true;
  s.story.sceneId="m05-masters-entry";s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_masters_entry");
  s=engine.resolveCombatHandoff(s,"win");
  s=await engine.choose(s,"win_seed");
  s=await engine.choose(s,"high_record");
  assert.equal(s.competition.rank,"A");
  assert.equal(s.world.flags.masters_seed_band,"high_entry");
  assert.equal(s.world.flags.rank_s_unlocked,undefined);
});

test("M5 module outcome window can open with Masters available but not yet played",async()=>{
  const {engine}=await makeEngine();let s=base();
  s.competition.rank="A";s.competition.rankOrder=5;
  s.world.flags.a5_masters_entry_available=true;
  s.story.sceneId="m05-masters-entry";s.story.nodeId="masters_entry";
  s=await engine.choose(s,"entry_defer");
  assert.equal(s.world.flags.m5_module_outcome_available,true);
  assert.equal(s.world.flags.masters_entry_complete,undefined);
  const v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="defer_outcome"));
});

test("M5_14 strict contract rejects missing Ancient Trace even if outcome flag is forged",async()=>{
  const {engine}=await makeEngine();let s=base();
  s.competition.rank="A";s.competition.rankOrder=5;
  s.world.flags.a5_masters_entry_available=true;
  s.world.flags.m5_module_outcome_available=true;
  delete s.world.flags.ancient_mystery_layer_1;
  s.story.sceneId="m05-module-outcome";s.story.nodeId="outcome_entry";
  await assert.rejects(()=>engine.present(s),/Scene conditions/);
});

test("M5_14 closes M5 and unlocks M6 without resetting persistent state",async()=>{
  const {engine}=await makeEngine();let s=base();
  s.competition.rank="A";s.competition.rankOrder=5;
  s.world.flags.a5_masters_entry_available=true;
  s.world.flags.m5_module_outcome_available=true;
  s.player.inventory={poke_ball:7};
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m05-module-outcome";s.story.nodeId="contract_audit";
  s=await engine.choose(s,"audit_complete");
  assert.equal(s.world.flags.m5_complete,true);
  assert.equal(s.world.flags.m06_unlocked,true);
  assert.equal(s.world.flags.m5_outcome_complete,true);
  assert.equal(s.competition.rank,"A");
  assert.deepEqual(s.player.roster,roster);
  assert.deepEqual(s.player.inventory,{poke_ball:7});
});

test("M5_14 completed handoff enters the real M6 entry without changing location",async()=>{
  const {engine}=await makeEngine();let s=base();s.competition.rank="A";s.competition.rankOrder=5;s.world.flags.a5_masters_entry_available=true;s.world.flags.m5_module_outcome_available=true;s.story.sceneId="m05-module-outcome";s.story.nodeId="contract_audit";
  s=await engine.choose(s,"audit_complete");s=await engine.choose(s,"complete_handoff");s=await engine.choose(s,"handoff_hub");
  assert.equal(s.story.sceneId,"m06-handoff");assert.equal(s.story.nodeId,"m06_entry");assert.equal(s.world.locationId,"alt_town");assert.equal(s.world.flags.m5_complete,true);assert.equal(s.world.flags.m06_unlocked,true);
});

test("M5 final state survives save and reload",async()=>{
  let dir;try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m5c3-"));const store=new SaveStore(dir);const {engine}=await makeEngine();
    let s=base();s.competition.rank="A";s.competition.rankOrder=5;
    s.world.flags.a5_masters_entry_available=true;s.world.flags.m5_module_outcome_available=true;
    s.story.sceneId="m05-module-outcome";s.story.nodeId="contract_audit";
    s=await engine.choose(s,"audit_complete");s.slot="slot1";
    await store.save(s);const l=await store.load("slot1");
    assert.deepEqual(l,s);
    assert.equal(l.world.flags.m06_unlocked,true);
  }finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
