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
const fixedNow=()=> "2026-10-06T12:20:00.000Z";

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
  s.player.trainerLevel=17;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,
    friends_split:true,m07_unlocked:true,red_met:true,friend_beat_06_complete:true,
    world_cutoff_state:"rank_s_at_cutoff",m6_world_cutoff_review_complete:true,
    m6_first_lighthouse_return_complete:true,ancient_mystery_layer_2:"pattern_confirmed"
  });
  s.world.locationId="first_lighthouse_ruins";
  return s;
}

test("M7_00 legal Rank S entry activates M7 without granting World qualification",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.story.sceneId="m07-handoff";s.story.nodeId="m07_entry";
  s=await engine.choose(s,"activate_m7");
  assert.equal(s.world.flags.m7_active,true);
  assert.equal(s.competition.rank,"S");
  assert.equal(s.world.flags.world_qualified,undefined);
  assert.equal(s.world.flags.cynthia_met,undefined);
});

test("M7_00 repeated entry is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.story.sceneId="m07-handoff";s.story.nodeId="m07_entry";
  s=await engine.choose(s,"activate_m7");
  s.story.sceneId="m07-handoff";s.story.nodeId="m07_entry";
  const view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="review_active_m7"));
  assert.equal(view.choices.some(c=>c.id==="activate_m7"),false);
});

test("M7_01 registers Meridiana as a real location without changing Rank",async()=>{
  const {engine}=await makeEngine();
  let s=base();s.world.flags.m7_active=true;
  s.story.sceneId="m07-meridiana-arrival";s.story.nodeId="arrival_entry";
  s=await engine.choose(s,"arrival_register");
  assert.equal(s.world.flags.m7_meridiana_arrived,true);
  assert.equal(s.world.locationId,"meridiana_city");
  assert.equal(s.competition.rank,"S");
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M7_02 observing Cynthia may defer without forcing first meeting",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true});
  s.story.sceneId="m07-cynthia-enters";s.story.nodeId="cynthia_entry";
  s=await engine.choose(s,"cynthia_observe");
  s=await engine.choose(s,"observe_defer");
  assert.equal(s.world.flags.cynthia_met,undefined);
  assert.equal(s.world.flags.cynthia_contact_deferred,true);
});

test("M7_02 first meeting registers persistent Cynthia and does not repeat",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true});
  s.story.sceneId="m07-cynthia-enters";s.story.nodeId="cynthia_entry";
  s=await engine.choose(s,"cynthia_introduce");
  assert.equal(s.world.flags.cynthia_met,true);
  assert.equal(s.npcs.Cynthia.name,"Cynthia");
  assert.equal(s.npcs.Cynthia.state.role,"world_candidate_anchor");
  s.story.sceneId="m07-cynthia-enters";s.story.nodeId="cynthia_entry";
  const view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="cynthia_reengage"));
  assert.equal(view.choices.some(c=>c.id==="cynthia_introduce"),false);
});

test("M7_03 sponsor posture persists but never grants qualification or rank",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true,cynthia_met:true});
  s.story.sceneId="m07-media-sponsor";s.story.nodeId="sponsor_desk";
  s=await engine.choose(s,"sponsor_major");
  s=await engine.choose(s,"major_commit");
  assert.equal(s.world.flags.m7_sponsor_path,"major_partner");
  assert.equal(s.competition.rank,"S");
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M7_03 media training consumes time without modifying qualification",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true,cynthia_met:true});
  s.story.sceneId="m07-media-sponsor";s.story.nodeId="media_training";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"training_interview");
  assert.equal(s.world.elapsedMinutes-before,30);
  assert.equal(s.world.flags.m7_media_training_done,true);
  assert.equal(s.world.flags.world_qualified,undefined);
});

test("M7_04 readiness reads actual roster size",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true,m7_media_sponsor_reviewed:true});
  s.story.sceneId="m07-pro-preparation";s.story.nodeId="ready_check";
  s.player.roster=[{id:"a"},{id:"b"},{id:"c"},{id:"d"},{id:"e"}];
  let view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="ready_six"),false);
  s.player.roster.push({id:"f"});
  view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="ready_six"));
});

test("M7_04 closes preparation without registering the World Qualifier",async()=>{
  const {engine}=await makeEngine();
  let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true,m7_media_sponsor_reviewed:true});
  s.player.roster=[{id:"a"},{id:"b"},{id:"c"},{id:"d"},{id:"e"},{id:"f"}];
  s.story.sceneId="m07-pro-preparation";s.story.nodeId="ready_check";
  s=await engine.choose(s,"ready_six");
  assert.equal(s.world.flags.m7_pro_preparation_complete,true);
  assert.equal(s.world.flags.world_qualified,undefined);
  assert.equal(s.world.flags.m7_qualifier_registered,undefined);
});

test("M7 cycle1 save/reload preserves Cynthia and sponsor posture",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m7c1-"));
    const store=new SaveStore(dir);
    const {engine}=await makeEngine();
    let s=base();Object.assign(s.world.flags,{m7_active:true,m7_meridiana_arrived:true});
    s.story.sceneId="m07-cynthia-enters";s.story.nodeId="cynthia_entry";
    s=await engine.choose(s,"cynthia_introduce");
    Object.assign(s.world.flags,{m7_sponsor_path:"independent",m7_media_sponsor_reviewed:true});
    s.slot="slot1";await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.cynthia_met,true);
    assert.equal(loaded.world.flags.m7_sponsor_path,"independent");
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
