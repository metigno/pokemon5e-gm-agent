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

function trialState(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="D";s.competition.rankOrder=2;s.player.roster=roster3();s.competition.trials.RANK_D_TO_C={checkpointId:"RANK_D_TO_C",fromRank:"D",toRank:"C",requiredRosterSize:3,retryable:true,available:true,registered:true,registeredAtMinutes:s.world.elapsedMinutes,attempts:0,lastResult:null,bestResult:null,completed:false};Object.assign(s.world.flags,{m1_complete:true,m02_unlocked:true,m2_active:true,m2_complete:true,m03_unlocked:true,m3_active:true});s.story.sceneId="m03-promotion-trial-d-c";s.story.nodeId="trial_gate_call";s.world.locationId="fer_city_arena";return s;}
test("M3_13 compiles D to C checkpoint",async()=>{const {bundle}=await makeEngine();assert.ok(bundle.scenes["m03-promotion-trial-d-c"].nodes.examiner_briefing);});
test("M3_13 begin_trial creates correct promotion metadata",async()=>{const {engine}=await makeEngine();let s=trialState();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");assert.equal(s.pending.competition.checkpointId,"RANK_D_TO_C");assert.equal(s.pending.competition.fromRank,"D");assert.equal(s.pending.competition.toRank,"C");assert.equal(s.pending.competition.officialRosterSize,3);assert.equal(s.pending.opponentRegistered,true);assert.equal(s.competition.trials.RANK_D_TO_C.attempts,1);});
test("M3_13 win promotes only through E5",async()=>{const {engine}=await makeEngine();let s=trialState();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s=await engine.resolveCombatHandoff(s,"win");assert.equal(s.competition.rank,"C");assert.equal(s.competition.trials.RANK_D_TO_C.completed,true);assert.equal(s.story.sceneId,"m03-trial-result");assert.equal(s.story.nodeId,"trial_win");});
test("M3_13 loss remains Rank D and reopens retry",async()=>{const {engine}=await makeEngine();let s=trialState();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s=await engine.resolveCombatHandoff(s,"lose");assert.equal(s.competition.rank,"D");assert.equal(s.competition.trials.RANK_D_TO_C.available,true);assert.equal(s.competition.trials.RANK_D_TO_C.registered,false);assert.equal(s.story.nodeId,"trial_loss");});
test("M3_13 pending combat survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m313-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=trialState();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.equal(l.pending.competition.checkpointId,"RANK_D_TO_C");assert.equal(l.competition.rank,"D");}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
