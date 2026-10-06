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
const fixedNow=()=> "2026-10-06T13:05:00.000Z";

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
    friend_beat_07_complete:true,friend_beat_07_friend_id:"Daniel",friend_beat_07_type:"remote",
    m7_media_sponsor_reviewed:true,m7_pro_preparation_complete:true,
    m7_qualifier_registered:true,m7_qualifier_complete:true,m7_qualifier_result_resolved:true,
    m7_qualifier_bracket_result:"eliminated_qualifying_match",m7_qualifier_result:"eliminated_qualifying_match",
    m7_last_chance_gate_complete:true,m7_last_chance_route_ready:true,a7_last_chance_available:true
  });
  s.world.locationId="meridiana_grand_hall";
  s.competition.history=[
    {matchId:"A7_WORLD_QUALIFIER_R1",type:"official_match",outcome:"win"},
    {matchId:"A7_WORLD_QUALIFIER_FINAL",type:"official_match",outcome:"lose"}
  ];
  return s;
}

function quietPriorEvents(s,bundle){
  for(const e of bundle.worldEvents){
    if(e.id.startsWith("A7_")||e.id.startsWith("M7_")) continue;
    s.events[e.id]={status:"resolved",outcomeId:"prior_complete",firedAtMinutes:0};
  }
  return s;
}

function setSchedule(s,id,locationId,present=true){
  s.npcs[id].schedule={
    id:"m7_final_"+id.toLowerCase(),
    locationId,
    availability:present?"available":"away",
    activity:"worlds_transition",
    startsAtMinutes:null,
    endsAtMinutes:null,
    present
  };
  return s;
}

test("M7_10 Last Chance is one finite Official Six ELITE match",async()=>{
  const {bundle}=await makeEngine();
  const s=bundle.scenes["m07-last-chance"];
  const combat=s.nodes.handoff.choices[0].combat;
  assert.equal(combat.competition.matchId,"A7_LAST_CHANCE_FINAL");
  assert.equal(combat.competition.officialRosterSize,6);
  assert.equal(combat.competition.difficulty,"ELITE");
  assert.equal(combat.opponentBench.length,5);
  const combatChoices=Object.values(s.nodes).flatMap(n=>n.choices??[]).filter(c=>c.combat);
  assert.equal(combatChoices.length,1);
});

test("M7_10 E5 win return does not qualify until the explicit result commit",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  s.story.sceneId="m07-last-chance";s.story.nodeId="win";
  s=await engine.choose(s,"win_record");
  assert.equal(s.world.flags.m7_last_chance_match_result,"win");
  assert.equal(s.world.flags.m7_last_chance_complete,true);
  assert.equal(s.world.flags.world_qualified,undefined);
  s=await engine.choose(s,"win_commit");
  assert.equal(s.world.flags.world_qualified,true);
  assert.equal(s.world.flags.m7_last_chance_result,"qualified");
  assert.equal(s.world.flags.a7_before_lights_available,true);
});

test("M7_10 loss consumes the route and never creates another retry",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  s.story.sceneId="m07-last-chance";s.story.nodeId="loss";
  s=await engine.choose(s,"loss_record");
  s=await engine.choose(s,"loss_commit");
  assert.equal(s.world.flags.m7_last_chance_complete,true);
  assert.equal(s.world.flags.m7_last_chance_result,"lost");
  assert.equal(s.world.flags.world_qualified,false);
  assert.equal(s.world.flags.last_chance_eligible,false);
});

test("M7_11 only exposes friends whose current schedule is present",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{world_qualified:true,a7_before_lights_available:true});
  s=setSchedule(s,"Daniel","meridiana_grand_hall",true);
  s=setSchedule(s,"Mattew","luminara_hub",false);
  s.story.sceneId="m07-before-the-lights";s.story.nodeId="friend_dispatch";
  const view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="friend_daniel"));
  assert.equal(view.choices.some(c=>c.id==="friend_mattew"),false);
});

test("M7_11 physical friend contact requires the friend to actually be at the Grand Hall",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{world_qualified:true,a7_before_lights_available:true});
  s=setSchedule(s,"Daniel","meridiana_grand_hall",true);
  s.story.sceneId="m07-before-the-lights";s.story.nodeId="daniel";
  let view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="daniel_physical"));
  assert.equal(view.choices.some(c=>c.id==="daniel_remote"),false);
  s.npcs.Daniel.schedule.locationId="luminara_hub";
  view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="daniel_physical"),false);
  assert.ok(view.choices.some(c=>c.id==="daniel_remote"));
});

test("M7_12 is legal after a lost Last Chance and records worlds_missed without changing Rank",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{world_qualified:false,m7_last_chance_complete:true,m7_last_chance_result:"lost"});
  s.story.sceneId="m07-worlds-missed";s.story.nodeId="record";
  s=await engine.choose(s,"record_commit");
  assert.equal(s.world.flags.worlds_missed,true);
  assert.equal(s.world.flags.m7_worlds_missed_resolved,true);
  assert.equal(s.competition.rank,"S");
});

test("M7_12 cannot open while an unused Last Chance route is still ready",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  s.story.sceneId="m07-worlds-missed";s.story.nodeId="missed_entry";
  await assert.rejects(()=>engine.present(s),/Scene conditions are not satisfied/);
});

test("M7_13 qualified branch unlocks M8 only",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{world_qualified:true,a7_before_lights_available:true,m7_before_lights_complete:true});
  s.story.sceneId="m07-module-outcome";s.story.nodeId="commit_qualified";
  s=await engine.choose(s,"commit_q_now");
  assert.equal(s.world.flags.m7_complete,true);
  assert.equal(s.world.flags.m08_unlocked,true);
  assert.equal(s.world.flags.m12_unlocked,undefined);
  assert.equal(s.world.flags.m7_outcome,"world_qualified");
});

test("M7_13 worlds-missed branch unlocks M12 only",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{world_qualified:false,m7_last_chance_route_ready:false,worlds_missed:true,m7_worlds_missed_resolved:true});
  s.story.sceneId="m07-module-outcome";s.story.nodeId="commit_missed";
  s=await engine.choose(s,"commit_m_now");
  assert.equal(s.world.flags.m7_complete,true);
  assert.equal(s.world.flags.m12_unlocked,true);
  assert.equal(s.world.flags.m08_unlocked,undefined);
  assert.equal(s.world.flags.m7_outcome,"worlds_missed");
});

test("M7 final state survives save/reload",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m7final-"));
    const store=new SaveStore(dir);
    const {engine,bundle}=await makeEngine();
    let s=quietPriorEvents(base(),bundle);
    Object.assign(s.world.flags,{world_qualified:false,m7_last_chance_route_ready:false,worlds_missed:true,m7_worlds_missed_resolved:true});
    s.story.sceneId="m07-module-outcome";s.story.nodeId="commit_missed";
    s=await engine.choose(s,"commit_m_now");
    s.slot="slot1";await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.m7_complete,true);
    assert.equal(loaded.world.flags.m12_unlocked,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});


test("M7_13 cannot bypass the final branch-resolution beat",async()=>{
  const {engine,bundle}=await makeEngine();
  let s=quietPriorEvents(base(),bundle);
  Object.assign(s.world.flags,{world_qualified:true});
  delete s.world.flags.m7_before_lights_complete;
  s.story.sceneId="m07-module-outcome";s.story.nodeId="outcome_entry";
  await assert.rejects(()=>engine.present(s),/Scene conditions are not satisfied/);
  s.world.flags.m7_before_lights_complete=true;
  const view=await engine.present(s);
  assert.equal(view.sceneId,"m07-module-outcome");
});
