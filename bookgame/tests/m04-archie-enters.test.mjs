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

function legal(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="C";s.competition.rankOrder=3;s.player.trainerLevel=8;Object.assign(s.world.flags,{m3_complete:true,m04_unlocked:true,m4_active:true,mareasale_discovered:true,mareasale_weather_read:true});s.story.sceneId="m04-archie-enters";s.story.nodeId="weather_office_intro";s.world.locationId="mar_city_weather";return s;}
test("M4_03 compiles Archie entry and recovery nodes",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m04-archie-enters"];for(const n of ["weather_office_intro","harbor_master_intro","deferred_intro","first_exchange","ocean_first","port_argument","archie_close"])assert.ok(s.nodes[n]);});
test("M4_03 first introduction registers persistent Archie and archie_met",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");assert.equal(s.world.flags.archie_met,true);assert.equal(s.npcs.Archie.name,"Archie");assert.equal(s.npcs.Archie.state.role,"maritime_anchor");});
test("M4_03 listening first does not force the meeting",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_listen_first");s=await engine.choose(s,"listen_leave");assert.equal(s.world.flags.archie_met,undefined);assert.equal(s.world.flags.archie_contact_deferred,true);});
test("M4_03 deferred contact can recover mandatory Archie meeting",async()=>{const {engine}=await makeEngine();let s=legal();s.story.nodeId="deferred_intro";s.world.flags.archie_contact_deferred=true;s=await engine.choose(s,"deferred_introduce");assert.equal(s.world.flags.archie_met,true);assert.equal(s.world.flags.archie_contact_recovered,true);assert.ok(s.npcs.Archie);});
test("M4_03 already-met Archie uses reengage instead of duplicate registration",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");s.story.sceneId="m04-archie-enters";s.story.nodeId="weather_office_intro";const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="weather_reengage"));assert.equal(v.choices.some(c=>c.id==="weather_introduce"),false);});
test("M4_03 safety disagreement changes relationship without hostility scripting",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");const before=s.npcs.Archie.relationship.score;s=await engine.choose(s,"challenge_safety");assert.ok(s.npcs.Archie.relationship.score>before);assert.equal(s.npcs.Archie.relationship.qualitative,"Neutral");});
test("M4_03 adaptation agreement records common-ground path",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");s=await engine.choose(s,"agree_adaptation");s=await engine.choose(s,"adapt_close");assert.equal(s.world.flags.archie_adaptation_common_ground,true);});
test("M4_03 people principle proves ocean-first is not automatic recklessness",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");s=await engine.choose(s,"ask_ocean_first");s=await engine.choose(s,"ocean_ask_people");s=await engine.choose(s,"people_record");assert.equal(s.world.flags.archie_people_principle_known,true);});
test("M4_03 port-pressure topic is gated by actual prior context",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");let v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="ask_port"),false);s.world.flags.mareasale_quay_observed=true;v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="ask_port"));});
test("M4_03 port discussion persists shared context on Archie",async()=>{const {engine}=await makeEngine();let s=legal();s.world.flags.mareasale_quay_observed=true;s=await engine.choose(s,"weather_introduce");s=await engine.choose(s,"ask_port");s=await engine.choose(s,"port_record");assert.equal(s.world.flags.archie_port_pressure_principle,true);assert.equal(s.npcs.Archie.state.sharedPortPressureContext,true);});
test("M4_03 never changes competition rank roster or money",async()=>{const {engine}=await makeEngine();let s=legal();s.player.money=888;s.player.roster=[{id:"a",species:"Growlithe"}];const roster=structuredClone(s.player.roster);s=await engine.choose(s,"weather_introduce");s=await engine.choose(s,"ask_ocean_first");assert.equal(s.competition.rank,"C");assert.equal(s.player.money,888);assert.deepEqual(s.player.roster,roster);});
test("M4_03 close returns to Mareasale hub",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");s=await engine.choose(s,"end_first_exchange");s=await engine.choose(s,"close_hub");assert.equal(s.story.sceneId,"m04-mareasale-arrival");assert.equal(s.story.nodeId,"city_hub");});
test("M4_03 state survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m403-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"weather_introduce");s=await engine.choose(s,"agree_adaptation");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.archie_met,true);assert.ok(l.npcs.Archie);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
