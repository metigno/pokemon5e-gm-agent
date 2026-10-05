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
const fixedNow=()=> "2026-10-05T23:00:00.000Z";
async function makeEngine(){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};}
function roster3(){return [{id:"p1",species:"Growlithe",level:7},{id:"p2",species:"Bulbasaur",level:7},{id:"p3",species:"Shinx",level:7}];}

function winState(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="C";s.competition.rankOrder=3;s.player.roster=roster3();Object.assign(s.world.flags,{m1_complete:true,m02_unlocked:true,m2_active:true,m2_complete:true,m03_unlocked:true,m3_active:true,steven_met:true,friend_beat_03_complete:true,ferrox_rescue_state:"balanced_support",ferrox_rescue_outcome_complete:true});s.story.sceneId="m03-trial-result";s.story.nodeId="trial_win";s.world.locationId="fer_city_arena";return s;}
function lossState(){const s=winState();s.competition.rank="D";s.competition.rankOrder=2;s.story.nodeId="trial_loss";s.competition.trials.RANK_D_TO_C={checkpointId:"RANK_D_TO_C",fromRank:"D",toRank:"C",requiredRosterSize:3,retryable:true,available:true,registered:false,registeredAtMinutes:null,attempts:1,lastResult:"lose",bestResult:"lose",completed:false};return s;}
test("M3_14 exit is visible when all mandatory contracts are complete",async()=>{const {engine}=await makeEngine();const v=await engine.present(winState());assert.ok(v.choices.some(c=>c.id==="close_m3"));});
test("M3_14 optional Cup does not block exit when never registered",async()=>{const {engine}=await makeEngine();let s=winState();s=await engine.choose(s,"close_m3");assert.equal(s.world.flags.m3_complete,true);assert.equal(s.world.flags.m04_unlocked,true);});
test("M3_14 registered unresolved Cup blocks exit",async()=>{const {engine}=await makeEngine();const s=winState();s.world.flags.regional_cup_registered=true;const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="close_m3"),false);assert.ok(v.choices.some(c=>c.id==="review_pending"));});
test("M3_14 registered Cup with result allows exit",async()=>{const {engine}=await makeEngine();const s=winState();s.world.flags.regional_cup_registered=true;s.world.flags.regional_cup_result="semifinal";const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="close_m3"));});
test("M3_14 missing Friend Beat exposes real pending item",async()=>{const {engine}=await makeEngine();let s=winState();delete s.world.flags.friend_beat_03_complete;s=await engine.choose(s,"review_pending");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="pending_friend"));});
test("M3_14 loss keeps Rank D and returns to registration",async()=>{const {engine}=await makeEngine();let s=lossState();s=await engine.choose(s,"retry");assert.equal(s.story.sceneId,"m03-trial-registration");assert.equal(s.story.nodeId,"trial_desk");assert.equal(s.competition.rank,"D");});
test("M3_14 closing module preserves roster and prior state",async()=>{const {engine}=await makeEngine();let s=winState();s.player.money=999;const roster=structuredClone(s.player.roster);s=await engine.choose(s,"close_m3");assert.deepEqual(s.player.roster,roster);assert.equal(s.player.money,999);assert.equal(s.world.flags.ferrox_rescue_state,"balanced_support");});
test("M3_14 completion survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m314-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=winState();s=await engine.choose(s,"close_m3");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.equal(l.world.flags.m3_complete,true);assert.equal(l.world.flags.m04_unlocked,true);assert.equal(l.competition.rank,"C");}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
