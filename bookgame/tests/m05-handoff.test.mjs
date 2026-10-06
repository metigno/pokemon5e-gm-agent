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
const fixedNow=()=> "2026-10-06T07:30:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function legal(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="B";
  s.competition.rankOrder=4;
  s.player.trainerLevel=11;
  Object.assign(s.world.flags,{
    m1_complete:true,
    m2_complete:true,
    m03_unlocked:true,
    m3_active:true,
    m3_complete:true,
    m04_unlocked:true,
    m4_active:true,
    m4_complete:true,
    m05_unlocked:true,
    steven_met:true,
    friend_beat_03_complete:true,
    ferrox_rescue_state:"balanced_support",
    ferrox_rescue_outcome_complete:true,
    archie_met:true,
    friend_beat_04_complete:true,
    upper_regional_result:"skipped",
    smuggling_state:"resolved_without_player"
  });
  s.story.sceneId="m05-handoff";
  s.story.nodeId="m05_entry";
  s.world.locationId="mar_city";
  return s;
}

test("M5_00 compiles exact first-cycle allocation",async()=>{
  const {bundle}=await makeEngine();
  const s=bundle.scenes["m05-handoff"];
  assert.equal(Object.keys(s.nodes).length,13);
  assert.equal(Object.values(s.nodes).reduce((n,node)=>n+(node.choices?.length??0),0),28);
});

test("M5_00 legal Rank B entry exposes activation",async()=>{
  const {engine}=await makeEngine();
  const v=await engine.present(legal());
  assert.ok(v.choices.some(c=>c.id==="activate_m5"));
});

test("M5_00 activation is idempotent and does not grant progression",async()=>{
  const {engine}=await makeEngine();
  let s=legal();
  s=await engine.choose(s,"activate_m5");
  assert.equal(s.world.flags.m5_active,true);
  assert.equal(s.competition.rank,"B");
  assert.equal(s.world.flags.lance_met,undefined);
  assert.equal(s.world.flags.interregional_license,undefined);
  assert.equal(s.competition.trials.RANK_B_TO_A,undefined);
  s.story.sceneId="m05-handoff";
  s.story.nodeId="m05_entry";
  const v=await engine.present(s);
  assert.ok(v.choices.some(c=>c.id==="review_active_m5"));
  assert.equal(v.choices.some(c=>c.id==="activate_m5"),false);
});

test("M5_00 blocks invalid entry state",async()=>{
  const {engine}=await makeEngine();
  const wrongRank=legal();
  wrongRank.competition.rank="C";
  wrongRank.competition.rankOrder=3;
  await assert.rejects(()=>engine.present(wrongRank),/Scene conditions/);
  const missingComplete=legal();
  delete missingComplete.world.flags.m4_complete;
  await assert.rejects(()=>engine.present(missingComplete),/Scene conditions/);
  const missingUnlock=legal();
  delete missingUnlock.world.flags.m05_unlocked;
  await assert.rejects(()=>engine.present(missingUnlock),/Scene conditions/);
});

test("M5_00 preserves roster money and prior callbacks",async()=>{
  const {engine}=await makeEngine();
  let s=legal();
  s.player.money=4321;
  s.player.roster=[{id:"a",species:"Growlithe",hp:{current:7,max:20},pp:{ember:1},statuses:["poisoned"]}];
  const roster=structuredClone(s.player.roster);
  s=await engine.choose(s,"activate_m5");
  s=await engine.choose(s,"band_review_carryover");
  assert.equal(s.player.money,4321);
  assert.deepEqual(s.player.roster,roster);
  assert.equal(s.world.flags.ferrox_rescue_state,"balanced_support");
  assert.equal(s.world.flags.smuggling_state,"resolved_without_player");
});

test("M5_00 mountain departure advances real time and changes location",async()=>{
  const {engine}=await makeEngine();
  let s=legal();
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"activate_m5");
  s=await engine.choose(s,"band_depart_mountains");
  s=await engine.choose(s,"depart_route");
  s=await engine.choose(s,"route_cautious");
  s=await engine.choose(s,"start_mountains");
  assert.equal(s.story.sceneId,"m05-mountain-approach");
  assert.equal(s.story.nodeId,"mountain_departure");
  assert.equal(s.world.locationId,"fer_mountains");
  assert.equal(s.world.elapsedMinutes-before,180);
});

test("M5_00 can remain in Mareasale without losing activation",async()=>{
  const {engine}=await makeEngine();
  let s=legal();
  s=await engine.choose(s,"activate_m5");
  s=await engine.choose(s,"band_stay_mareasale");
  assert.equal(s.story.sceneId,"m04-mareasale-arrival");
  assert.equal(s.world.flags.m5_active,true);
});

test("M5_00 survives save/reload",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m500-"));
    const store=new SaveStore(dir);
    const {engine}=await makeEngine();
    let s=legal();
    s=await engine.choose(s,"activate_m5");
    s.slot="slot1";
    await store.save(s);
    const loaded=await store.load("slot1");
    assert.deepEqual(loaded,s);
    assert.equal(loaded.world.flags.m5_active,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
