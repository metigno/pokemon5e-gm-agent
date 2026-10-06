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
const fixedNow=()=> "2026-10-06T12:35:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="S";
  s.competition.rankOrder=6;
  s.player.trainerLevel=18;
  s.player.roster=[{id:"a"},{id:"b"},{id:"c"},{id:"d"},{id:"e"},{id:"f"}];
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,
    friends_split:true,m07_unlocked:true,m7_active:true,m7_meridiana_arrived:true,cynthia_met:true,
    friend_beat_06_complete:true,friend_beat_06_friend_id:"Mattew",
    m7_media_sponsor_reviewed:true,m7_pro_preparation_complete:true
  });
  s.world.locationId="meridiana_city";
  return s;
}

function quietPriorEvents(s,bundle){
  for(const e of bundle.worldEvents){
    if(e.id.startsWith("A7_")||e.id.startsWith("M7_")) continue;
    s.events[e.id]={status:"resolved",outcomeId:"prior_complete",firedAtMinutes:0};
  }
  return s;
}

function setSchedule(s,id,locationId){
  s.npcs[id].schedule={
    id:"m7_test_"+id.toLowerCase(),
    locationId,
    availability:"available",
    activity:"world_qualifier_preparation",
    startsAtMinutes:null,
    endsAtMinutes:null,
    present:true
  };
  return s;
}

test("M7 cycle-two canonical ACT_7 and Friend Beat bindings compile",async()=>{
  const {bundle}=await makeEngine();
  const ids=new Set(bundle.worldEvents.map(e=>e.id));
  for(const id of ["A7_WORLD_QUALIFIER","A7_LAST_CHANCE","A7_BEFORE_LIGHTS","M7_FRIEND_BEAT_SELECT"]){
    assert.ok(ids.has(id),id);
  }
});

test("M7 Friend Beat selector rotates away from protagonist and M6 friend",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  s.story.sceneId="m07-pro-preparation";s.story.nodeId="ready_check";
  s=await engine.choose(s,"ready_six");
  assert.equal(s.world.flags.friend_beat_07_available,true);
  assert.notEqual(s.world.flags.friend_beat_07_friend_id,"Luke");
  assert.notEqual(s.world.flags.friend_beat_07_friend_id,"Mattew");
  assert.equal(s.world.flags.a7_world_qualifier_available,true);
});

test("M7 Friend Beat uses physical mode only for a real shared Meridiana location",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(setSchedule(base(),"Daniel","meridiana_city"),bundle);
  s.story.sceneId="m07-pro-preparation";s.story.nodeId="ready_check";
  s=await engine.choose(s,"ready_six");
  assert.equal(s.world.flags.friend_beat_07_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_07_contact_mode,"physical");
});

test("M7 Friend Beat remote mode does not teleport the selected friend",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(setSchedule(base(),"Daniel","luminara_hub"),bundle);
  s.story.sceneId="m07-pro-preparation";s.story.nodeId="ready_check";
  s=await engine.choose(s,"ready_six");
  assert.equal(s.world.flags.friend_beat_07_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_07_contact_mode,"remote");
  assert.equal(s.npcs.Daniel.schedule.locationId,"luminara_hub");
});

test("M7_05 completion persists friend identity and never grants qualification",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{friend_beat_07_available:true,friend_beat_07_friend_id:"Daniel",friend_beat_07_contact_mode:"remote"});
  s.story.sceneId="m07-friend-beat-07";s.story.nodeId="daniel_contact";
  const before=s.npcs.Daniel.relationship.score;
  s=await engine.choose(s,"daniel_remote");
  s=await engine.choose(s,"remote_pressure");
  s=await engine.choose(s,"pressure_relationship");
  s=await engine.choose(s,"relationship_record");
  s=await engine.choose(s,"record_complete");
  assert.equal(s.world.flags.friend_beat_07_complete,true);
  assert.equal(s.world.flags.friend_beat_07_type,"remote");
  assert.equal(s.world.flags.world_qualified,undefined);
  assert.ok(s.npcs.Daniel.relationship.score>before);
});

test("M7_06 registration requires the real Official Six and does not qualify",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{friend_beat_07_complete:true,a7_world_qualifier_available:true});
  s.story.sceneId="m07-qualifier-registration";s.story.nodeId="roster_review";
  s.player.roster=s.player.roster.slice(0,5);
  let view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="roster_ready"),false);
  s.player.roster.push({id:"f"});
  view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="roster_ready"));
  s.story.nodeId="confirmation";
  s=await engine.choose(s,"confirm_register");
  assert.equal(s.world.flags.m7_qualifier_registered,true);
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M7_07 uses fixed Official Six ELITE rosters for both qualifier matches",async()=>{
  const {bundle}=await makeEngine();
  const q=bundle.scenes["m07-world-qualifier"];
  for(const nodeId of ["round1_handoff","qual_handoff"]){
    const combat=q.nodes[nodeId].choices[0].combat;
    assert.equal(combat.competition.officialRosterSize,6);
    assert.equal(combat.competition.difficulty,"ELITE");
    assert.equal(combat.opponentBench.length,5);
  }
});

test("M7_07 Round 1 loss closes the main qualifier lane without retry",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{friend_beat_07_complete:true,m7_qualifier_registered:true});
  s.story.sceneId="m07-world-qualifier";s.story.nodeId="round1_loss";
  s=await engine.choose(s,"round1_loss_result");
  assert.equal(s.world.flags.m7_qualifier_round1_result,"loss");
  assert.equal(s.world.flags.m7_qualifier_bracket_result,"eliminated_round1");
  assert.equal(s.world.flags.m7_qualifier_complete,true);
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M7_07 decisive win still waits for M7_08 before setting world_qualified",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{friend_beat_07_complete:true,m7_qualifier_registered:true,m7_qualifier_round1_result:"win"});
  s.story.sceneId="m07-world-qualifier";s.story.nodeId="qual_win";
  s=await engine.choose(s,"qual_win_result");
  assert.equal(s.world.flags.m7_qualifier_bracket_result,"qualified");
  assert.equal(s.world.flags.m7_qualifier_complete,true);
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M7_08 qualified classifier is the only cycle-two path that sets world_qualified true",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{m7_qualifier_complete:true,m7_qualifier_bracket_result:"qualified"});
  s.story.sceneId="m07-qualifier-result";s.story.nodeId="qualified_record";
  s=await engine.choose(s,"qualified_commit");
  assert.equal(s.world.flags.world_qualified,true);
  assert.equal(s.world.flags.m7_qualifier_result,"qualified");
  assert.equal(s.world.flags.last_chance_eligible,false);
  assert.equal(s.world.flags.m7_qualifier_result_resolved,true);
});

test("M7_08 elimination opens finite A7_LAST_CHANCE instead of replaying the Qualifier",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{m7_qualifier_complete:true,m7_qualifier_bracket_result:"eliminated_qualifying_match",m7_qualifier_result:"eliminated_qualifying_match"});
  s.story.sceneId="m07-qualifier-result";s.story.nodeId="eliminated_record";
  s=await engine.choose(s,"elimination_confirm");
  assert.equal(s.world.flags.world_qualified,false);
  assert.equal(s.world.flags.last_chance_eligible,true);
  assert.equal(s.world.flags.a7_last_chance_available,true);
  assert.equal(s.events.A7_LAST_CHANCE.status,"resolved");
});

test("M7_09 opens the route only when Last Chance eligibility is real",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{m7_qualifier_result_resolved:true,world_qualified:false,last_chance_eligible:true,a7_last_chance_available:true});
  s.story.sceneId="m07-last-chance-gate";s.story.nodeId="eligibility";
  let view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="eligibility_open"));
  s.world.flags.last_chance_eligible=false;
  view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="eligibility_open"),false);
  assert.ok(view.choices.some(c=>c.id==="eligibility_closed"));
});

test("M7 cycle-two state survives save/reload",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m7c2-"));
    const store=new SaveStore(dir);
    const {engine,bundle}=await makeEngine();
    let s=quietPriorEvents(base(),bundle);
    Object.assign(s.world.flags,{m7_qualifier_complete:true,m7_qualifier_bracket_result:"qualified"});
    s.story.sceneId="m07-qualifier-result";s.story.nodeId="qualified_record";
    s=await engine.choose(s,"qualified_commit");
    s.slot="slot1";await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.world_qualified,true);
    assert.equal(loaded.world.flags.m7_qualifier_result,"qualified");
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
