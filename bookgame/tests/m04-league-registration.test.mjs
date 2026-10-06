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

function state(hour=9){const s=base();s.world.flags.a4_league_reg_available=true;s.story.sceneId="m04-league-registration";s.story.nodeId="registration_hall";s.world.locationId="mar_city_arena";return setClock(s,hour);}
test("M4_09 compiles registration, defer and decline states",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m04-league-registration"];for(const n of ["registration_hall","registration_desk","registered","deferred","decline_confirm","declined"])assert.ok(s.nodes[n]);});
test("M4_09 morning exposes open registration desk",async()=>{const {engine}=await makeEngine();const v=await engine.present(state(9));assert.ok(v.choices.some(c=>c.id==="open_desk_morning"));assert.equal(v.choices.some(c=>c.id==="closed_evening"),false);});
test("M4_09 evening closes desk instead of allowing registration",async()=>{const {engine}=await makeEngine();const v=await engine.present(state(19));assert.ok(v.choices.some(c=>c.id==="closed_evening"));assert.equal(v.choices.some(c=>c.id==="open_desk_morning"),false);});
test("M4_09 registration writes canonical registration state only",async()=>{const {engine}=await makeEngine();let s=state();const h=s.competition.history.length;s=await engine.choose(s,"open_desk_morning");s=await engine.choose(s,"register_upper_regional");assert.equal(s.world.flags.upper_regional_registration_complete,true);assert.equal(s.world.flags.upper_regional_registration_status,"registered");assert.equal(s.world.flags.upper_regional_result,undefined);assert.equal(s.competition.rank,"C");assert.equal(s.competition.history.length,h);});
test("M4_09 registration activates A4_REGIONAL_LEAGUE through Living World",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"open_desk_morning");s=await engine.choose(s,"register_upper_regional");assert.equal(s.events.A4_REGIONAL_LEAGUE.status,"resolved");assert.equal(s.world.flags.a4_regional_league_available,true);});
test("M4_09 defer does not register or fabricate result",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"review_calendar");s=await engine.choose(s,"calendar_defer");assert.equal(s.world.flags.upper_regional_registration_complete,undefined);assert.equal(s.world.flags.upper_regional_result,undefined);});
test("M4_09 permanent decline records skipped result and no match",async()=>{const {engine}=await makeEngine();let s=state();const h=s.competition.history.length;s=await engine.choose(s,"review_calendar");s=await engine.choose(s,"calendar_decline");s=await engine.choose(s,"confirm_decline");assert.equal(s.world.flags.upper_regional_result,"skipped");assert.equal(s.world.flags.upper_regional_registration_status,"declined");assert.equal(s.competition.history.length,h);});
test("M4_09 skipped result activates A4_AFTER_LEAGUE but not a fake bracket win",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"review_calendar");s=await engine.choose(s,"calendar_decline");s=await engine.choose(s,"confirm_decline");assert.equal(s.world.flags.a4_after_league_available,true);assert.notEqual(s.world.flags.upper_regional_result,"winner");});
test("M4_09 already registered state cannot duplicate registration choice",async()=>{const {engine}=await makeEngine();let s=state();s.world.flags.upper_regional_registration_complete=true;s.world.flags.upper_regional_registration_status="registered";s.story.nodeId="registration_desk";const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="register_upper_regional"),false);assert.ok(v.choices.some(c=>c.id==="registration_status"));});
test("M4_09 closed-office wait advances real E2 time",async()=>{const {engine}=await makeEngine();let s=state(19);const before=s.world.elapsedMinutes;s=await engine.choose(s,"closed_evening");s=await engine.choose(s,"closed_wait_morning");assert.equal(s.world.elapsedMinutes-before,360);assert.equal(s.world.flags.upper_regional_office_waited,true);});
test("M4_09 survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m409-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"open_desk_morning");s=await engine.choose(s,"register_upper_regional");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.upper_regional_registration_complete,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
