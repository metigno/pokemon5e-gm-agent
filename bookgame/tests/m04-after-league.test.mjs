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
const fixedNow=()=> "2026-10-06T08:15:00.000Z";
async function makeEngine(){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};}
function roster4(){return [{id:"p1",species:"Growlithe",level:10},{id:"p2",species:"Bulbasaur",level:10},{id:"p3",species:"Shinx",level:10},{id:"p4",species:"Psyduck",level:10}];}
function base(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="C";s.competition.rankOrder=3;s.player.trainerLevel=9;s.player.roster=roster4();Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m3_complete:true,m04_unlocked:true,m4_active:true,mareasale_discovered:true});s.world.locationId="mar_city";return s;}

function state(){const s=base();s.competition.rank="B";s.competition.rankOrder=4;Object.assign(s.world.flags,{archie_met:true,friend_beat_04_complete:true,friend_beat_04_friend_id:"Mattew",friend_beat_04_type:"remote_call",friend_beat_04_result:"remote_exchange",upper_regional_result:"skipped",smuggling_state:"customs_monitoring"});s.story.sceneId="m04-after-league";s.story.nodeId="after_entry";s.world.locationId="mar_city";return s;}
test("M4_14 compiles consequence and exit-audit nodes",async()=>{const {bundle}=await makeEngine();const x=bundle.scenes["m04-after-league"];for(const n of ["after_entry","upper_result","smuggling_result","rank_result","exit_audit","module_complete"])assert.ok(x.nodes[n]);});
test("M4_14 Rank B alone cannot unlock M5",async()=>{const {engine}=await makeEngine();let s=base();s.competition.rank="B";s.competition.rankOrder=4;s.story.sceneId="m04-after-league";s.story.nodeId="exit_audit";const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="complete_m4"),false);assert.equal(s.world.flags.m05_unlocked,undefined);});
test("M4_14 complete exit contract unlocks M5 and marks M4 complete",async()=>{const {engine}=await makeEngine();let s=state();s.story.nodeId="exit_audit";s=await engine.choose(s,"complete_m4");assert.equal(s.world.flags.m4_complete,true);assert.equal(s.world.flags.m05_unlocked,true);assert.equal(s.world.flags.m4_outcome_complete,true);assert.equal(s.story.nodeId,"module_complete");});
test("M4_14 skipped Upper Regional is a valid persistent result",async()=>{const {engine}=await makeEngine();let s=state();s.story.nodeId="exit_audit";const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="complete_m4"));});
test("M4_14 missing smuggling state routes back instead of inventing outcome",async()=>{const {engine}=await makeEngine();let s=state();delete s.world.flags.smuggling_state;s.story.nodeId="exit_audit";let v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="complete_m4"),false);assert.ok(v.choices.some(c=>c.id==="missing_smuggling"));s=await engine.choose(s,"missing_smuggling");assert.equal(s.story.nodeId,"smuggling_missing");});
test("M4_14 completion preserves roster money and prior callbacks",async()=>{const {engine}=await makeEngine();let s=state();s.player.money=4321;s.world.flags.ferrox_rescue_state="balanced_support";const roster=structuredClone(s.player.roster);s.story.nodeId="exit_audit";s=await engine.choose(s,"complete_m4");assert.equal(s.player.money,4321);assert.deepEqual(s.player.roster,roster);assert.equal(s.world.flags.ferrox_rescue_state,"balanced_support");assert.equal(s.competition.rank,"B");});
test("M4_14 first post-promotion choice resolves A4_AFTER_LEAGUE",async()=>{const {engine}=await makeEngine();let s=state();delete s.world.flags.a4_after_league_available;delete s.events.A4_AFTER_LEAGUE;s=await engine.choose(s,"review_rank");assert.equal(s.world.flags.a4_after_league_available,true);assert.equal(s.events.A4_AFTER_LEAGUE.status,"resolved");});
test("M4_14 save/reload preserves formal module completion",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m414-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s.story.nodeId="exit_audit";s=await engine.choose(s,"complete_m4");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.m4_complete,true);assert.equal(l.world.flags.m05_unlocked,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
