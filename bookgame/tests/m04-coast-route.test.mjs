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

function state(){const s=base();s.story.sceneId="m04-coast-route";s.story.nodeId="coast_gate";s.world.locationId="sal_coast";return s;}
test("M4_05 compiles explorable coast and ecology branches",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m04-coast-route"];for(const n of ["high_path","shore_path","salt_cove","coast_jetty","coast_fauna_view","coast_pressure_link"])assert.ok(s.nodes[n]);});
test("M4_05 coast supports three distinct exploration routes",async()=>{const {engine}=await makeEngine();const v=await engine.present(state());for(const id of ["take_high_path","take_shore_path","visit_coast_jetty"])assert.ok(v.choices.some(c=>c.id===id));});
test("M4_05 Survival success opens safe cove window",async()=>{const {engine}=await makeEngine(new SequenceDice([20]));let s=state();s=await engine.choose(s,"take_shore_path");s=await engine.choose(s,"shore_tide_check");assert.equal(s.world.flags.coast_tide_read_quality,"clear");assert.equal(s.story.nodeId,"tide_read_success");s=await engine.choose(s,"tide_success_cove");assert.equal(s.world.flags.coast_cove_safe_window,true);});
test("M4_05 Survival failure does not force unsafe cove access",async()=>{const {engine}=await makeEngine(new SequenceDice([1]));let s=state();s=await engine.choose(s,"take_shore_path");s=await engine.choose(s,"shore_tide_check");assert.equal(s.world.flags.coast_tide_read_quality,"partial");const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="tide_success_cove"),false);});
test("M4_05 ecology encounter comes from SAL-COAST and remains capturable",async()=>{const {engine}=await makeEngine(new SequenceDice([1]));let s=state();s=await engine.choose(s,"take_high_path");s=await engine.choose(s,"high_watch_fauna");s=await engine.choose(s,"observe_coast_fauna");assert.equal(s.ecology.lastEncounter.zoneId,"SAL-COAST");assert.equal(s.ecology.lastEncounter.capturable,true);assert.ok(["wingull","wattrel","sandygast","binacle","finizen"].includes(s.ecology.lastEncounter.speciesId));});
test("M4_05 cove evidence creates a hypothesis not final smuggling state",async()=>{const {engine}=await makeEngine(new SequenceDice([20,20]));let s=state();s.world.flags.port_pressure_complete=true;s=await engine.choose(s,"take_shore_path");s=await engine.choose(s,"shore_tide_check");s=await engine.choose(s,"tide_success_cove");s=await engine.choose(s,"cove_check_marks");s=await engine.choose(s,"marks_pressure_link");s=await engine.choose(s,"pressure_link_record");assert.equal(s.world.flags.smuggling_coast_link_known,true);assert.equal(s.world.flags.smuggling_state,undefined);});
test("M4_05 reef discussion can hand off to real M4_06",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"take_shore_path");s=await engine.choose(s,"shore_fisher");s=await engine.choose(s,"fisher_ask_reef");s=await engine.choose(s,"fisher_reef_access");assert.equal(s.story.sceneId,"m04-reef-access");assert.equal(s.story.nodeId,"reef_desk");});
test("M4_05 FRIEND_BEAT hook is state-gated",async()=>{const {engine}=await makeEngine();let s=state();let v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="coast_friend_beat_04"),false);s.world.flags.friend_beat_04_available=true;v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="coast_friend_beat_04"));});
test("M4_05 return to Mareasale preserves M4 and prior state",async()=>{const {engine}=await makeEngine();let s=state();s.world.flags.ferrox_rescue_state="balanced_support";s=await engine.choose(s,"coast_return_city");assert.equal(s.story.sceneId,"m04-mareasale-arrival");assert.equal(s.world.flags.m4_active,true);assert.equal(s.world.flags.ferrox_rescue_state,"balanced_support");});
test("M4_05 survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m405-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"take_high_path");s=await engine.choose(s,"high_old_marker");s=await engine.choose(s,"marker_record");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.coast_route_history_known,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
