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
const fixedNow=()=> "2026-10-06T10:54:00.000Z";

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
  s.competition.rank="A";
  s.competition.rankOrder=5;
  s.player.trainerLevel=14;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,
    m06_unlocked:true,interregional_license:true,friend_beat_05_complete:true,lance_met:true,
    ancient_trace_state:"partial",masters_entry_complete:true
  });
  s.world.locationId="alt_town";
  return s;
}

test("M6_00 legal Rank A entry activates M6 without granting later progression",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.story.sceneId="m06-handoff";s.story.nodeId="m06_entry";
  s=await engine.choose(s,"activate_m6");
  assert.equal(s.world.flags.m6_active,true);
  assert.equal(s.competition.rank,"A");
  assert.equal(s.world.flags.red_met,undefined);
  assert.equal(s.world.flags.friend_beat_06_complete,undefined);
  assert.equal(s.world.flags.m07_unlocked,undefined);
});

test("M6_00 repeated entry is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.story.sceneId="m06-handoff";s.story.nodeId="m06_entry";
  s=await engine.choose(s,"activate_m6");
  s.story.sceneId="m06-handoff";s.story.nodeId="m06_entry";
  const v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="review_active_m6"));
  assert.equal(v.choices.some(c=>c.id==="activate_m6"),false);
});

test("M6_01 route selection persists one real plan without requiring both destinations",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.world.flags.m6_active=true;s.story.sceneId="m06-route-selection";s.story.nodeId="route_entry";
  s=await engine.choose(s,"entry_board");
  s=await engine.choose(s,"board_solaria");
  s=await engine.choose(s,"solaria_confirm");
  assert.equal(s.world.flags.m6_route_plan,"solaria");
  assert.equal(s.competition.rank,"A");
  assert.equal(s.world.flags.m6_first_destination,undefined);
});

test("M6_02 Solaria travel consumes real time before arrival",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{m6_active:true,m6_route_selection_complete:true,m6_route_plan:"solaria"});
  s.story.sceneId="m06-interregional-travel";s.story.nodeId="travel_entry";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"travel_board");
  s=await engine.choose(s,"depart_solaria");
  assert.equal(s.world.elapsedMinutes-before,240);
  assert.equal(s.world.flags.m6_travel_started,"solaria");
  assert.equal(s.world.flags.m6_interregional_travel_complete,undefined);
});

test("M6_02 arrival records geography but never changes Rank",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{m6_active:true,m6_route_selection_complete:true,m6_route_plan:"solaria",m6_travel_started:"solaria"});
  s.story.sceneId="m06-interregional-travel";s.story.nodeId="customs";
  s=await engine.choose(s,"customs_solaria");
  s=await engine.choose(s,"solaria_register");
  assert.equal(s.world.flags.m6_first_destination,"solaria");
  assert.equal(s.world.flags.m6_interregional_travel_complete,true);
  assert.equal(s.world.locationId,"solaria_hub");
  assert.equal(s.competition.rank,"A");
});

test("M6_03 observing Red may defer without forcing first meeting",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{m6_active:true,m6_interregional_travel_complete:true,m6_first_destination:"solaria"});
  s.story.sceneId="m06-red-enters";s.story.nodeId="red_entry";
  s=await engine.choose(s,"red_observe");
  s=await engine.choose(s,"observe_defer");
  assert.equal(s.world.flags.red_met,undefined);
  assert.equal(s.world.flags.red_contact_deferred,true);
});

test("M6_03 first meeting registers persistent Red and does not repeat",async()=>{
  const {engine}=await makeEngine();
  let s=base();
  Object.assign(s.world.flags,{m6_active:true,m6_interregional_travel_complete:true,m6_first_destination:"luminara"});
  s.story.sceneId="m06-red-enters";s.story.nodeId="red_entry";
  s=await engine.choose(s,"red_introduce");
  assert.equal(s.world.flags.red_met,true);
  assert.equal(s.npcs.Red.name,"Red");
  assert.equal(s.npcs.Red.state.role,"interregional_anchor");
  s.story.sceneId="m06-red-enters";s.story.nodeId="red_entry";
  const v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="red_reengage"));
  assert.equal(v.choices.some(c=>c.id==="red_introduce"),false);
});

test("M6_04 Masters Circuit keeps Rank A separate from registration",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.world.flags.m6_active=true;
  s.story.sceneId="m06-masters-circuit";s.story.nodeId="masters_entry";
  s=await engine.choose(s,"masters_hub");
  s=await engine.choose(s,"hub_event");
  s=await engine.choose(s,"event_register");
  s=await engine.choose(s,"register_match");
  assert.equal(s.world.flags.m6_masters_registered,true);
  assert.equal(s.competition.rank,"A");
  assert.equal(s.world.flags.m6_masters_result,undefined);
});

test("M6_04 official match gate uses real roster size",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.world.flags.m6_active=true;s.world.flags.m6_masters_registered=true;
  s.story.sceneId="m06-masters-circuit";s.story.nodeId="match_confirm";
  s.player.roster=[{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
  let v=await engine.present(s);
  assert.equal(v.choices.some(c=>c.id==="confirm_fight"),false);
  s.player.roster.push({id:"e"});
  v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="confirm_fight"));
});

test("M6 cycle1 save/reload preserves route and Anchor state",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m6c1-"));
    const store=new SaveStore(dir);
    const {engine}=await makeEngine();
    let s=base();
    Object.assign(s.world.flags,{m6_active:true,m6_interregional_travel_complete:true,m6_first_destination:"solaria",m6_route_plan:"solaria"});
    s.story.sceneId="m06-red-enters";s.story.nodeId="red_entry";
    s=await engine.choose(s,"red_introduce");
    s.slot="slot1";await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.m6_route_plan,"solaria");
    assert.equal(loaded.world.flags.red_met,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
