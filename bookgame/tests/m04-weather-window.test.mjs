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
const fixedNow=()=> "2026-10-06T02:30:00.000Z";
async function makeEngine(){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};}
function setClock(s,hour,minute=0){s.world.elapsedMinutes=(hour*60)+minute;s.world.day=1;s.world.minuteOfDay=(hour*60)+minute;s.world.time=hour<6?"night":hour<12?"morning":hour<18?"afternoon":"evening";return s;}

function legal(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="C";s.competition.rankOrder=3;s.player.trainerLevel=8;Object.assign(s.world.flags,{m3_complete:true,m04_unlocked:true,m4_active:true,mareasale_discovered:true});s.story.sceneId="m04-weather-window";s.story.nodeId="weather_board";s.world.locationId="mar_city_weather";return setClock(s,9);}
test("M4_02 compiles time-gated weather nodes",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m04-weather-window"];for(const n of ["weather_board","morning_window","afternoon_window","evening_window","night_window","departure_board","harbor_master"])assert.ok(s.nodes[n]);});
test("M4_02 morning exposes only morning read",async()=>{const {engine}=await makeEngine();const v=await engine.present(legal());assert.ok(v.choices.some(c=>c.id==="read_morning"));assert.equal(v.choices.some(c=>c.id==="read_afternoon"),false);assert.equal(v.choices.some(c=>c.id==="read_night"),false);});
test("M4_02 morning read records favorable window",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");assert.equal(s.world.flags.mareasale_weather_read,true);assert.equal(s.world.flags.mareasale_weather_state,"favorable_morning");});
test("M4_02 afternoon exposes crosswind window",async()=>{const {engine}=await makeEngine();let s=setClock(legal(),14);const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="read_afternoon"));s=await engine.choose(s,"read_afternoon");assert.equal(s.world.flags.mareasale_weather_state,"crosswind_afternoon");});
test("M4_02 evening exposes rising-wind window",async()=>{const {engine}=await makeEngine();let s=setClock(legal(),19);s=await engine.choose(s,"read_evening");assert.equal(s.world.flags.mareasale_weather_state,"rising_evening");});
test("M4_02 night closes non-essential departures",async()=>{const {engine}=await makeEngine();let s=setClock(legal(),2);const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="read_night"));s=await engine.choose(s,"read_night");assert.equal(s.world.flags.mareasale_weather_state,"night_closed");});
test("M4_02 waiting advances the real world clock and can change daypart",async()=>{const {engine}=await makeEngine();let s=setClock(legal(),17);s=await engine.choose(s,"read_afternoon");s=await engine.choose(s,"afternoon_wait");assert.equal(s.world.elapsedMinutes,19*60);assert.equal(s.world.time,"evening");assert.equal(s.story.nodeId,"weather_board");});
test("M4_02 reef condition knowledge is informational only",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_tide_board");s=await engine.choose(s,"tide_note");assert.equal(s.world.flags.mareasale_reef_conditions_known,true);assert.equal(s.world.flags.reef_access_granted,undefined);});
test("M4_02 forecast can reveal Archie rumor without meeting him",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_forecast");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="forecast_ask_trainer"));s=await engine.choose(s,"forecast_note");assert.equal(s.world.flags.archie_met,undefined);});
test("M4_02 forecast route to Archie writes rumor but not met before scene resolves",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_forecast");s=await engine.choose(s,"forecast_ask_trainer");assert.equal(s.story.sceneId,"m04-archie-enters");assert.equal(s.story.nodeId,"weather_office_intro");assert.equal(s.world.flags.archie_rumor_heard,true);assert.equal(s.world.flags.archie_met,undefined);});
test("M4_02 harbor pressure links weather to logistics without creating smuggling state",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_harbor_master");s=await engine.choose(s,"harbor_ask_pressure");s=await engine.choose(s,"pressure_note");assert.equal(s.world.flags.mareasale_weather_pressure_linked,true);assert.equal(s.world.flags.smuggling_state,undefined);});
test("M4_02 departure board records dynamic-window principle",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_departures");s=await engine.choose(s,"departure_record");assert.equal(s.world.flags.mareasale_departure_logic_known,true);});
test("M4_02 never changes rank or registers competitions",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_departures");s=await engine.choose(s,"departure_plan");s=await engine.choose(s,"plan_record");assert.equal(s.competition.rank,"C");assert.equal(s.competition.trials.RANK_C_TO_B,undefined);assert.equal(s.world.flags.upper_regional_registration_complete,undefined);});
test("M4_02 save/reload preserves weather knowledge and world clock",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m402-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"read_morning");s=await engine.choose(s,"morning_departures");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.mareasale_weather_state,"favorable_morning");}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
