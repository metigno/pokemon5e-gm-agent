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
const fixedNow=()=> "2026-10-06T13:50:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function sixRoster(){
  return Array.from({length:6},(_,i)=>({
    id:"p"+i,
    speciesId:"test_"+i,
    name:"P"+i,
    level:20,
    hp:{current:20-i,max:20},
    statuses:[],
    abilityId:"test_ability",
    moveIds:["move_a","move_b"],
    pp:[5,5]
  }));
}

function base(){
  const s=createNewGameState({protagonist:"Luke",slot:"slot1",now:fixedNow});
  s.competition.rank="S";
  s.competition.rankOrder=6;
  s.player.trainerLevel=20;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,
    m7_complete:true,m08_unlocked:true,world_qualified:true,m7_before_lights_complete:true,
    m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,m8_medical_control_complete:true,
    m8_world_registration_complete:true,m8_world_roster_registered:true,m8_world_village_arrived:true,
    m8_world_village_orientation_complete:true,astrid_met:true,
    friend_beat_08_available:true,friend_beat_08_friend_id:"Daniel",friend_beat_08_contact_mode:"remote",
    friend_beat_08_type:"remote_world_contact",friend_beat_08_complete:true,
    m8_training_hall_complete:true,m8_media_day_complete:true,m8_opening_ceremony_complete:true
  });
  s.world.locationId="world_draw_hall";
  s.npcs.Daniel.state.worldQualified=true;
  s.npcs.Mattew.state.worldQualified=false;
  return s;
}

async function executeDraw(engine,state){
  const s=structuredClone(state);
  s.story.sceneId="m08-world-draw";
  s.story.nodeId="execute_draw";
  return engine.choose(s,"execute_now");
}

test("M8_10 WORLD_DRAW creates one structured 32-player field and 8 groups of 4",async()=>{
  const {engine}=await makeEngine();
  const s=await executeDraw(engine,base());
  const world=s.competition.world;
  assert.equal(world.drawComplete,true);
  assert.equal(world.fieldLocked,true);
  assert.equal(world.field.length,32);
  assert.equal(world.seedOrder.length,32);
  assert.equal(Object.keys(world.groups).length,8);
  for(const group of Object.values(world.groups)) assert.equal(group.length,4);
  assert.equal(new Set(world.field.map(p=>p.id)).size,32);
  assert.equal(world.playerOpponents.length,3);
  assert.ok(world.playerGroup);
  assert.equal(s.world.flags.world_draw_complete,true);
  assert.equal(s.world.flags.world_field_32_locked,true);
  assert.equal(s.world.flags.player_group,world.playerGroup);
});

test("M8_10 honors explicit NPC qualification state before off-screen simulation",async()=>{
  const {engine}=await makeEngine();
  const s=await executeDraw(engine,base());
  const names=new Set(s.competition.world.field.map(p=>p.name));
  assert.equal(names.has("Daniel"),true);
  assert.equal(names.has("Mattew"),false);
  const q=Object.values(s.competition.world.qualifications);
  assert.equal(q.find(x=>x.name==="Daniel").source,"npc_actual");
  assert.equal(q.find(x=>x.name==="Daniel").qualified,true);
  assert.equal(q.find(x=>x.name==="Mattew").source,"npc_actual");
  assert.equal(q.find(x=>x.name==="Mattew").qualified,false);
});

test("M8_10 pre-World Anchor guarantees enter the field but receive no result protection",async()=>{
  const {engine}=await makeEngine();
  const s=await executeDraw(engine,base());
  const names=new Set(s.competition.world.field.map(p=>p.name));
  for(const name of ["Astrid Vahl","Kaia Solari","Silas Crowe","Rei"]){
    assert.equal(names.has(name),true,name);
    const q=Object.values(s.competition.world.qualifications).find(x=>x.name===name);
    assert.ok(["npc_actual","macro_anchor_guarantee"].includes(q.source));
  }
  assert.equal(s.world.flags.world_champion,undefined);
  assert.equal(s.world.flags.world_group_advanced,undefined);
});

test("M8_10 does not force the other Four into the field",async()=>{
  const {engine}=await makeEngine();
  const s=await executeDraw(engine,base());
  const names=new Set(s.competition.world.field.map(p=>p.name));
  assert.equal(names.has("Mattew"),false);
  assert.equal(s.world.flags.friend_beat_08_friend_id,"Daniel");
});

test("M8_10 draw is idempotent within the same career and edition",async()=>{
  const {engine}=await makeEngine();
  let s=await executeDraw(engine,base());
  const before=structuredClone(s.competition.world);
  s.story.sceneId="m08-world-draw";
  s.story.nodeId="execute_draw";
  s=await engine.choose(s,"execute_now");
  assert.deepEqual(s.competition.world,before);
});

test("M8_10 career edition participates in the deterministic draw seed",async()=>{
  const {engine}=await makeEngine();
  const first=await executeDraw(engine,base());
  const secondBase=base();
  secondBase.competition.world.edition=2;
  const second=await executeDraw(engine,secondBase);
  assert.notEqual(first.competition.world.drawSeed,second.competition.world.drawSeed);
  assert.notDeepEqual(first.competition.world.seedOrder,second.competition.world.seedOrder);
});

test("M8_11 renders the actual group and three opponents from structured E5 state",async()=>{
  const {engine}=await makeEngine();
  let s=await executeDraw(engine,base());
  s.story.sceneId="m08-group-reveal";
  s.story.nodeId="group_identity";
  const view=await engine.present(s);
  assert.match(view.text,new RegExp("Gruppo "+s.competition.world.playerGroup));
  for(const opponent of s.competition.world.playerOpponents){
    assert.ok(view.text.includes(opponent.name));
  }
  assert.equal(view.text.includes("{{"),false);
});

test("M8_11 exit contract unlocks M9 without mutating the locked draw",async()=>{
  const {engine}=await makeEngine();
  let s=await executeDraw(engine,base());
  const draw=structuredClone(s.competition.world);
  s.story.sceneId="m08-group-reveal";
  s.story.nodeId="commit_m8";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m8_complete,true);
  assert.equal(s.world.flags.m09_unlocked,true);
  assert.equal(s.world.flags.m8_group_reveal_complete,true);
  assert.deepEqual(s.competition.world,draw);
});

test("M8_11 exit guard exposes commit only for the complete structured World state",async()=>{
  const {engine}=await makeEngine();
  let s=await executeDraw(engine,base());
  s.story.sceneId="m08-group-reveal";
  s.story.nodeId="exit_guard";
  let view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="exit_commit"));
  s.competition.world.playerGroup=null;
  view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="exit_commit"),false);
});

test("M8 final World draw state survives save/reload exactly",async()=>{
  let dir;
  try{
    const {engine}=await makeEngine();
    let s=await executeDraw(engine,base());
    s.story.sceneId="m08-group-reveal";
    s.story.nodeId="commit_m8";
    s=await engine.choose(s,"commit_now");
    dir=await mkdtemp(path.join(os.tmpdir(),"m8c3-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.competition.world.field.length,32);
    assert.equal(loaded.competition.world.playerOpponents.length,3);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
