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
async function makeEngine(){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};}
function setClock(s,hour,minute=0){s.world.elapsedMinutes=(hour*60)+minute;s.world.day=1;s.world.minuteOfDay=(hour*60)+minute;s.world.time=hour<6?"night":hour<12?"morning":hour<18?"afternoon":"evening";return s;}
function legal(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="B";s.competition.rankOrder=4;s.player.trainerLevel=11;
  Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m03_unlocked:true,m3_complete:true,m04_unlocked:true,m4_active:true,m4_complete:true,m05_unlocked:true,m5_active:true,altacima_discovered:true,archie_met:true,friend_beat_04_complete:true,upper_regional_result:"skipped",smuggling_state:"resolved_without_player"});
  s.story.sceneId="m05-weather-decisions";s.story.nodeId="weather_board";s.world.locationId="alt_town_weather";return setClock(s,9);
}

test("M5_04 compiles at 15 nodes and 34 choices",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m05-weather-decisions"];assert.equal(Object.keys(s.nodes).length,15);assert.equal(Object.values(s.nodes).reduce((n,node)=>n+(node.choices?.length??0),0),34);});

test("M5_04 departure cannot be confirmed without a route plan",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_route");s=await engine.choose(s,"route_direct");s=await engine.choose(s,"risk_commit");const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="gate_confirm"),false);assert.ok(v.choices.some(c=>c.id==="gate_cancel"));
});

test("M5_04 morning exposes only the morning window",async()=>{
  const {engine}=await makeEngine();const v=await engine.present(legal());assert.ok(v.choices.some(c=>c.id==="read_morning"));assert.equal(v.choices.some(c=>c.id==="read_afternoon"),false);assert.equal(v.choices.some(c=>c.id==="read_evening"),false);assert.equal(v.choices.some(c=>c.id==="read_night"),false);
});

test("M5_04 afternoon and evening remain distinct dynamic windows",async()=>{
  const {engine}=await makeEngine();let s=setClock(legal(),14);let v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="read_afternoon"));s=await engine.choose(s,"read_afternoon");s=await engine.choose(s,"afternoon_deviate");assert.equal(s.world.flags.m5_weather_state,"gusty_afternoon");
  s=setClock(legal(),19);v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="read_evening"));s=await engine.choose(s,"read_evening");assert.equal(s.story.nodeId,"evening_window");
});

test("M5_04 night closes ordinary high-route departure",async()=>{
  const {engine}=await makeEngine();let s=setClock(legal(),2);s=await engine.choose(s,"read_night");assert.equal(s.story.nodeId,"night_window");s=await engine.choose(s,"night_hub");assert.equal(s.world.flags.m5_weather_state,"night_closed");assert.equal(s.story.sceneId,"m05-altacima");
});

test("M5_04 postponement advances the real world clock",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");const before=s.world.elapsedMinutes;s=await engine.choose(s,"morning_wait");assert.equal(s.world.elapsedMinutes-before,60);assert.equal(s.story.nodeId,"postpone");
});

test("M5_04 route plan and departure readiness do not fabricate Fulgore arrival",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_route");s=await engine.choose(s,"route_direct");s=await engine.choose(s,"risk_commit");s=await engine.choose(s,"gate_confirm");assert.equal(s.world.flags.m5_fulgore_route_plan,"direct");assert.equal(s.world.flags.m5_fulgore_departure_ready,true);assert.equal(s.world.flags.fulgore_visited,undefined);assert.equal(s.competition.rank,"B");
});

test("M5_04 can persist the completed decision without granting Rank or license",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_route");s=await engine.choose(s,"route_sheltered");s=await engine.choose(s,"dev_accept");s=await engine.choose(s,"gate_confirm");s=await engine.choose(s,"record_complete");assert.equal(s.world.flags.m5_weather_decisions_complete,true);assert.equal(s.world.flags.interregional_license,undefined);assert.equal(s.competition.rank,"B");
});

test("M5_04 Lance callback is causal and never a hidden mechanical bonus",async()=>{
  const {engine}=await makeEngine();let without=setClock(legal(),19);without=await engine.choose(without,"read_evening");let v=await engine.present(without);assert.equal(v.choices.some(c=>c.id==="evening_lance"),false);
  let withLance=setClock(legal(),19);withLance.world.flags.lance_met=true;withLance=await engine.choose(withLance,"read_evening");v=await engine.present(withLance);assert.ok(v.choices.some(c=>c.id==="evening_lance"));withLance=await engine.choose(withLance,"evening_lance");withLance=await engine.choose(withLance,"lance_margin");assert.equal(withLance.world.flags.m5_lance_weather_callback_used,true);assert.equal(withLance.world.flags.m5_fulgore_departure_ready,undefined);
});

test("M5_04 save/reload preserves route and weather decision state",async()=>{
  let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m504-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_route");s=await engine.choose(s,"route_sheltered");s=await engine.choose(s,"dev_accept");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.m5_fulgore_route_plan,"sheltered");}finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
