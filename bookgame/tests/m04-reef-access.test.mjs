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
import { SequenceDice } from "../src/engine/dice.mjs";
const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const eventsDir=fileURLToPath(new URL("../content/events/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-06T07:00:00.000Z";
async function makeEngine(dice=new SequenceDice([1])){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,dice,now:fixedNow}),bundle};}
function base(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="C";s.competition.rankOrder=3;s.player.trainerLevel=8;Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m3_complete:true,m04_unlocked:true,m4_active:true,mareasale_discovered:true});s.world.locationId="mar_city";return s;}
function setClock(s,h,m=0){s.world.elapsedMinutes=h*60+m;s.world.day=1;s.world.minuteOfDay=h*60+m;s.world.time=h<6?"night":h<12?"morning":h<18?"afternoon":"evening";return s;}

function state(){const s=base();s.story.sceneId="m04-reef-access";s.story.nodeId="reef_desk";s.world.locationId="sal_coast_jetty";s.world.flags.mareasale_weather_state="favorable_morning";return setClock(s,9);}
test("M4_06 compiles reef access and MAR-REEF ecology",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m04-reef-access"];for(const n of ["window_check","departure_brief","reef_approach","reef_platform","reef_fauna_view","reef_return"])assert.ok(s.nodes[n]);assert.ok(bundle.ecology.zones["MAR-REEF"]);});
test("M4_06 favorable morning allows departure",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"check_current_window");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="window_open"));});
test("M4_06 stale morning weather cannot authorize reef",async()=>{const {engine}=await makeEngine();let s=state();s.world.flags.mareasale_weather_state="crosswind_afternoon";s=await engine.choose(s,"check_current_window");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="window_stale_morning"));assert.equal(v.choices.some(c=>c.id==="window_open"),false);});
test("M4_06 afternoon closes departure regardless of old favorable flag",async()=>{const {engine}=await makeEngine();let s=setClock(state(),14);s=await engine.choose(s,"check_current_window");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="window_crosswind"));assert.equal(v.choices.some(c=>c.id==="window_open"),false);});
test("M4_06 real departure consumes 45 minutes and sets authorized state",async()=>{const {engine}=await makeEngine();let s=state();const before=s.world.elapsedMinutes;s=await engine.choose(s,"check_current_window");s=await engine.choose(s,"window_open");s=await engine.choose(s,"depart_reef");assert.equal(s.world.elapsedMinutes-before,45);assert.equal(s.world.flags.reef_departure_authorized,true);assert.equal(s.story.nodeId,"reef_approach");});
test("M4_06 navigation check has real success and failure states",async()=>{let {engine}=await makeEngine(new SequenceDice([20]));let s=state();s.story.nodeId="reef_approach";s=await engine.choose(s,"read_channel");assert.equal(s.world.flags.reef_channel_read,"clear");({engine}=await makeEngine(new SequenceDice([1])));s=state();s.story.nodeId="reef_approach";s=await engine.choose(s,"read_channel");assert.equal(s.world.flags.reef_channel_read,"partial");});
test("M4_06 reef ecology uses new canonical MAR-REEF pool",async()=>{const {engine}=await makeEngine(new SequenceDice([1]));let s=state();s.story.nodeId="reef_fauna_view";s.world.locationId="mar_reef_approach";s=await engine.choose(s,"observe_reef_fauna");assert.equal(s.ecology.lastEncounter.zoneId,"MAR-REEF");assert.equal(s.ecology.lastEncounter.capturable,true);assert.ok(["chinchou","horsea","mareanie","corsola","finizen"].includes(s.ecology.lastEncounter.speciesId));});
test("M4_06 smuggling route link requires actual prior context",async()=>{const {engine}=await makeEngine();let s=state();s.story.nodeId="reef_platform";let v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="platform_route_link"),false);s.world.flags.smuggling_signal_quality="partial";v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="platform_route_link"));});
test("M4_06 visit does not create permanent weather permission",async()=>{const {engine}=await makeEngine();let s=state();s.story.nodeId="reef_return";s=await engine.choose(s,"return_coast");assert.equal(s.world.flags.reef_visited,true);assert.equal(s.world.flags.reef_access_granted,undefined);});
test("M4_06 survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m406-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s.story.nodeId="reef_platform";s=await engine.choose(s,"platform_observe");s=await engine.choose(s,"observation_record");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.reef_route_geography_known,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
