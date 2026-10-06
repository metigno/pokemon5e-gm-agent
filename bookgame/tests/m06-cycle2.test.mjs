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
const fixedNow=()=> "2026-10-06T11:15:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function base(protagonist="Luke"){
  const s=createNewGameState({protagonist,now:fixedNow});
  s.competition.rank="A";
  s.competition.rankOrder=5;
  s.player.trainerLevel=16;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,
    friends_split:true,
    m06_unlocked:true,m6_active:true,interregional_license:true,friend_beat_05_complete:true,
    friend_beat_05_friend_id:"Mattew",red_met:true
  });
  s.world.locationId="solaria_hub";
  return s;
}

function setSchedule(s,id,locationId){
  s.npcs[id].schedule={
    id:"m6_test_"+id.toLowerCase(),
    locationId,
    availability:"available",
    activity:"interregional_circuit",
    startsAtMinutes:null,
    endsAtMinutes:null,
    present:true
  };
  return s;
}

test("M6 cycle-two canonical ACT_6 event bindings compile",async()=>{
  const {bundle}=await makeEngine();
  const ids=new Set(bundle.worldEvents.map(e=>e.id));
  for(const id of ["A6_HIDDEN_TRAJECTORIES","A6_CONTINENTAL","M6_FRIEND_BEAT_SELECT","A6_RANK_TRIAL_A_S","A6_CUTOFF"]){
    assert.ok(ids.has(id),id);
  }
});

test("A6_HIDDEN_TRAJECTORIES rotates away from player and previous Friend Beat when possible",async()=>{
  const {engine}=await makeEngine();
  let s=base("Luke");
  s.story.sceneId="m06-handoff";s.story.nodeId="rank_a_band";
  s=await engine.choose(s,"band_routes");
  assert.equal(s.world.flags.a6_hidden_trajectories_available,true);
  assert.notEqual(s.world.flags.m6_trajectory_friend_id,"Luke");
  assert.notEqual(s.world.flags.m6_trajectory_friend_id,"Mattew");
  assert.equal(s.world.flags.a6_continental_available,true);
  assert.equal(s.competition.trials.RANK_A_TO_S.available,true);
  assert.equal(s.competition.trials.RANK_A_TO_S.registered,false);
});

test("A6_HIDDEN_TRAJECTORIES can select a different friend under another prior history",async()=>{
  const {engine}=await makeEngine();
  let s=base("Luke");
  s.world.flags.friend_beat_05_friend_id="Daniel";
  s.story.sceneId="m06-handoff";s.story.nodeId="rank_a_band";
  s=await engine.choose(s,"band_routes");
  assert.equal(s.world.flags.m6_trajectory_friend_id,"Mattew");
});

test("M6_05 completes visible trajectory without changing friend roster state",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{a6_hidden_trajectories_available:true,m6_trajectory_friend_id:"Daniel"});
  s.events.A6_HIDDEN_TRAJECTORIES={status:"resolved",outcomeId:"daniel_trajectory",firedAtMinutes:s.world.elapsedMinutes};
  const npcBefore=structuredClone(s.npcs.Daniel.state);
  s.story.sceneId="m06-hidden-trajectories";s.story.nodeId="record";
  s=await engine.choose(s,"record_complete");
  assert.equal(s.world.flags.m6_hidden_trajectories_complete,true);
  assert.deepEqual(s.npcs.Daniel.state,npcBefore);
});

test("M6 Friend Beat selector uses physical mode only when player and friend share the real location",async()=>{
  const {engine}=await makeEngine();
  let s=setSchedule(base(),"Daniel","solaria_hub");
  Object.assign(s.world.flags,{a6_hidden_trajectories_available:true,m6_trajectory_friend_id:"Daniel"});
  s.events.A6_HIDDEN_TRAJECTORIES={status:"resolved",outcomeId:"daniel_trajectory",firedAtMinutes:s.world.elapsedMinutes};
  s.story.sceneId="m06-hidden-trajectories";s.story.nodeId="record";
  s=await engine.choose(s,"record_complete");
  assert.equal(s.world.flags.friend_beat_06_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_06_contact_mode,"physical");
});

test("M6 Friend Beat selector falls back to remote without teleporting the friend",async()=>{
  const {engine}=await makeEngine();
  let s=setSchedule(base(),"Daniel","luminara_hub");
  Object.assign(s.world.flags,{a6_hidden_trajectories_available:true,m6_trajectory_friend_id:"Daniel"});
  s.events.A6_HIDDEN_TRAJECTORIES={status:"resolved",outcomeId:"daniel_trajectory",firedAtMinutes:s.world.elapsedMinutes};
  s.story.sceneId="m06-hidden-trajectories";s.story.nodeId="record";
  s=await engine.choose(s,"record_complete");
  assert.equal(s.world.flags.friend_beat_06_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_06_contact_mode,"remote");
  assert.equal(s.npcs.Daniel.schedule.locationId,"luminara_hub");
});

test("M6_06 remote Friend Beat persists relationship, type and completion",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{
    m6_hidden_trajectories_complete:true,
    friend_beat_06_available:true,
    friend_beat_06_friend_id:"Daniel",
    friend_beat_06_contact_mode:"remote"
  });
  s.story.sceneId="m06-friend-beat-06";s.story.nodeId="friend_call";
  const before=s.npcs.Daniel.relationship.score;
  s=await engine.choose(s,"dispatch_daniel");
  s=await engine.choose(s,"daniel_remote");
  s=await engine.choose(s,"remote_career");
  s=await engine.choose(s,"career_result");
  s=await engine.choose(s,"result_close");
  assert.equal(s.world.flags.friend_beat_06_complete,true);
  assert.equal(s.world.flags.friend_beat_06_type,"remote");
  assert.ok(s.npcs.Daniel.relationship.score>before);
});

test("M6_07 Continental registration is separate from Rank A to S Trial",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{friend_beat_06_complete:true,a6_continental_available:true});
  s.story.sceneId="m06-continental-entry";s.story.nodeId="continental_entry";
  s=await engine.choose(s,"entry_eligibility");
  s=await engine.choose(s,"eligible_register");
  s=await engine.choose(s,"register_now");
  assert.equal(s.world.flags.continental_registration_complete,true);
  assert.equal(s.competition.rank,"A");
  assert.equal(s.competition.trials.RANK_A_TO_S.available,true);
  assert.equal(s.competition.trials.RANK_A_TO_S.registered,false);
});

test("M6_08 Continental Cup uses fixed Official Five rosters for all three rounds",async()=>{
  const {bundle}=await makeEngine();
  const scene=bundle.scenes["m06-continental-cup"];
  for(const nodeId of ["qf_handoff","sf_handoff","final_handoff"]){
    const combat=scene.nodes[nodeId].choices[0].combat;
    assert.equal(combat.competition.officialRosterSize,5);
    assert.equal(combat.opponentBench.length,4);
    assert.equal(combat.competition.difficulty,"ELITE");
  }
});

test("M6_08 QF handoff requires a real five-Pokémon player roster",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{friend_beat_06_complete:true,continental_registration_complete:true});
  s.story.sceneId="m06-continental-cup";s.story.nodeId="qf_confirm";
  s.player.roster=[{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
  let v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="qf_start"),false);
  s.player.roster.push({id:"e"});
  v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="qf_start"));
});

test("M6_08 a real QF loss closes the Cup without changing Rank",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{friend_beat_06_complete:true,continental_registration_complete:true});
  s.story.sceneId="m06-continental-cup";s.story.nodeId="qf_loss";
  s=await engine.choose(s,"qf_loss_close");
  assert.equal(s.world.flags.continental_result,"quarterfinal");
  assert.equal(s.world.flags.continental_complete,true);
  assert.equal(s.competition.rank,"A");
});

test("M6_09 strong ancient evidence records only layer two and grants no Legendary",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{friend_beat_06_complete:true,continental_complete:true,m6_ancient_geo_evidence:"coherent_axis"});
  s.story.sceneId="m06-ancient-layer-two";s.story.nodeId="strong_layer";
  s=await engine.choose(s,"strong_record");
  assert.equal(s.world.flags.ancient_mystery_layer_2,"cross_region_pattern");
  assert.equal(s.world.flags.m6_ancient_layer_two_complete,true);
  assert.equal(s.world.flags.legendary_captured,undefined);
  assert.equal(s.competition.rank,"A");
});

test("M6_09 may persist an unresolved second layer after weak evidence",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{friend_beat_06_complete:true,continental_result:"skipped",continental_complete:true});
  s.story.sceneId="m06-ancient-layer-two";s.story.nodeId="weak_layer";
  s=await engine.choose(s,"weak_record");
  assert.equal(s.world.flags.ancient_mystery_layer_2,"second_layer_unresolved");
});

test("M6 cycle-two state survives save/reload",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m6c2-"));
    const store=new SaveStore(dir);
    const {engine}=await makeEngine();
    let s=base();
    Object.assign(s.world.flags,{friend_beat_06_complete:true,continental_complete:true,m6_ancient_geo_evidence:"coherent_axis"});
    s.story.sceneId="m06-ancient-layer-two";s.story.nodeId="strong_layer";
    s=await engine.choose(s,"strong_record");
    s.slot="slot1";
    await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.ancient_mystery_layer_2,"cross_region_pattern");
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
