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
const fixedNow=()=> "2026-10-06T13:20:00.000Z";

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
    level:20,
    hp:{current:20-i,max:20},
    statuses:i===1?["fatigued"]:[],
    pp:[5,5,5,5]
  }));
}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="S";
  s.competition.rankOrder=6;
  s.player.trainerLevel=18;
  s.player.roster=sixRoster();
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,
    m7_complete:true,m08_unlocked:true,world_qualified:true,m7_before_lights_complete:true,
    friend_beat_07_complete:true,m7_qualifier_result_resolved:true
  });
  s.world.locationId="meridiana_city";
  return s;
}

test("M8_00 legal qualified entry activates M8 without changing qualification or Rank",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.story.sceneId="m08-world-arrival";s.story.nodeId="world_entry";
  s=await engine.choose(s,"activate_m8");
  assert.equal(s.world.flags.m8_active,true);
  assert.equal(s.world.flags.world_qualified,true);
  assert.equal(s.competition.rank,"S");
  assert.equal(s.world.flags.world_draw_complete,undefined);
});

test("M8_00 physical arrival changes location but does not fabricate draw state",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.world.flags.m8_active=true;
  s.story.sceneId="m08-world-arrival";s.story.nodeId="commit_now";
  s=await engine.choose(s,"commit_arrival");
  assert.equal(s.world.flags.m8_world_arrived,true);
  assert.equal(s.world.locationId,"world_championship_venue");
  assert.equal(s.world.flags.world_draw_complete,undefined);
  assert.equal(s.world.flags.player_group,undefined);
});

test("M8_00 repeated entry is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.world.flags.m8_active=true;
  s.story.sceneId="m08-world-arrival";s.story.nodeId="world_entry";
  const view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="review_m8"));
  assert.equal(view.choices.some(c=>c.id==="activate_m8"),false);
});

test("M8_01 accreditation persists without changing roster, Rank or draw",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m8_active:true,m8_world_arrived:true});
  const rosterBefore=structuredClone(s.player.roster);
  s.story.sceneId="m08-accreditation";s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m8_accreditation_complete,true);
  assert.deepEqual(s.player.roster,rosterBefore);
  assert.equal(s.competition.rank,"S");
  assert.equal(s.world.flags.world_draw_complete,undefined);
});

test("M8_02 medical control never heals or rewrites the real roster",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true});
  const rosterBefore=structuredClone(s.player.roster);
  s.story.sceneId="m08-medical-control";s.story.nodeId="schedule_cost";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"schedule_exam");
  assert.equal(s.world.elapsedMinutes-before,30);
  assert.deepEqual(s.player.roster,rosterBefore);
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m8_medical_control_complete,true);
  assert.deepEqual(s.player.roster,rosterBefore);
});

test("M8_03 registration reads the actual roster size",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,m8_medical_control_complete:true});
  s.story.sceneId="m08-registration";s.story.nodeId="roster_review";
  s.player.roster=s.player.roster.slice(0,5);
  let view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="roster_ready"),false);
  assert.ok(view.choices.some(c=>c.id==="roster_missing"));
  s.player.roster.push({id:"p5",speciesId:"test_5",level:20,hp:{current:20,max:20},statuses:[],pp:[5,5,5,5]});
  view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="roster_ready"));
  assert.equal(view.choices.some(c=>c.id==="roster_missing"),false);
});

test("M8_03 registration never performs WORLD_DRAW or assigns a group",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,m8_medical_control_complete:true});
  s.story.sceneId="m08-registration";s.story.nodeId="confirmation";
  s=await engine.choose(s,"confirm_register");
  assert.equal(s.world.flags.m8_world_registration_complete,true);
  assert.equal(s.world.flags.m8_world_roster_registered,true);
  assert.equal(s.world.flags.world_draw_complete,undefined);
  assert.equal(s.world.flags.world_field_32_locked,undefined);
  assert.equal(s.world.flags.player_group,undefined);
});

test("M8_04 registers the World Village as a real location and keeps causal NPC rules",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,m8_medical_control_complete:true,m8_world_registration_complete:true});
  s.story.sceneId="m08-world-village";s.story.nodeId="village_entry";
  s=await engine.choose(s,"entry_register");
  assert.equal(s.world.flags.m8_world_village_arrived,true);
  assert.equal(s.world.locationId,"world_village");
  assert.equal(s.world.flags.astrid_met,undefined);
  assert.equal(s.world.flags.friend_beat_08_complete,undefined);
});

test("M8_04 waiting advances time without forcing Astrid or Friend Beat",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,m8_medical_control_complete:true,m8_world_registration_complete:true,m8_world_village_arrived:true});
  s.story.sceneId="m08-world-village";s.story.nodeId="wait_window";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"wait_hour");
  assert.equal(s.world.elapsedMinutes-before,60);
  assert.equal(s.world.flags.astrid_met,undefined);
  assert.equal(s.world.flags.friend_beat_08_complete,undefined);
});

test("M8 cycle1 save/reload preserves accreditation, medical and registration state",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m8c1-"));
    const store=new SaveStore(dir);
    let s=base();
    Object.assign(s.world.flags,{
      m8_active:true,m8_world_arrived:true,m8_accreditation_complete:true,
      m8_medical_control_complete:true,m8_world_registration_complete:true,
      m8_world_roster_registered:true,m8_world_village_arrived:true
    });
    s.world.locationId="world_village";
    s.slot="slot1";
    await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.world_qualified,true);
    assert.equal(loaded.world.flags.world_draw_complete,undefined);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
