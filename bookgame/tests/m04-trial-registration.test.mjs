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

function state(){const s=base();s.world.flags.a4_rank_trial_c_b_available=true;s.story.sceneId="m04-trial-registration";s.story.nodeId="trial_info";s.world.locationId="mar_city_arena";return s;}
test("M4_12 compiles C to B registration flow",async()=>{const {bundle}=await makeEngine();const x=bundle.scenes["m04-trial-registration"];for(const n of ["trial_info","eligibility_audit","trial_desk","roster_review","registered","attempt_history"])assert.ok(x.nodes[n]);});
test("M4_12 A4 event now creates structured E5 Trial availability",async()=>{const {engine}=await makeEngine();let s=base();s.player.trainerLevel=9;s.story.sceneId="m04-mareasale-arrival";s.story.nodeId="city_hub";s=await engine.choose(s,"hub_overlook");assert.equal(s.world.flags.a4_rank_trial_c_b_available,true);assert.equal(s.competition.trials.RANK_C_TO_B.available,true);assert.equal(s.competition.trials.RANK_C_TO_B.requiredRosterSize,4);});
test("M4_12 old-save fallback can idempotently create missing Trial state",async()=>{const {engine}=await makeEngine();let s=state();s.events.A4_RANK_TRIAL_C_B={status:"resolved",outcomeId:"legacy_flag_only",firedAtMinutes:s.world.elapsedMinutes};assert.equal(s.competition.trials.RANK_C_TO_B,undefined);s=await engine.choose(s,"eligibility_audit");s=await engine.choose(s,"sync_trial_state");assert.equal(s.competition.trials.RANK_C_TO_B.available,true);assert.equal(s.competition.trials.RANK_C_TO_B.requiredRosterSize,4);});
test("M4_12 four Pokemon can register",async()=>{const {engine}=await makeEngine();let s=state();s.competition.trials.RANK_C_TO_B={checkpointId:"RANK_C_TO_B",fromRank:"C",toRank:"B",requiredRosterSize:4,retryable:true,available:true,registered:false,registeredAtMinutes:null,attempts:0,lastResult:null,bestResult:null,completed:false};s=await engine.choose(s,"go_desk");s=await engine.choose(s,"register_now");assert.equal(s.competition.trials.RANK_C_TO_B.registered,true);assert.equal(s.competition.rank,"C");});
test("M4_12 roster of three cannot register",async()=>{const {engine}=await makeEngine();let s=state();s.player.roster=s.player.roster.slice(0,3);s.competition.trials.RANK_C_TO_B={checkpointId:"RANK_C_TO_B",fromRank:"C",toRank:"B",requiredRosterSize:4,retryable:true,available:true,registered:false,registeredAtMinutes:null,attempts:0,lastResult:null,bestResult:null,completed:false};s=await engine.choose(s,"go_desk");const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="register_now"),false);});
test("M4_12 Upper Regional winner does not bypass gate",async()=>{const {engine}=await makeEngine();let s=state();s.world.flags.upper_regional_result="winner";s.competition.trials.RANK_C_TO_B={checkpointId:"RANK_C_TO_B",fromRank:"C",toRank:"B",requiredRosterSize:4,retryable:true,available:true,registered:false,registeredAtMinutes:null,attempts:0,lastResult:null,bestResult:null,completed:false};s=await engine.choose(s,"format_review");s=await engine.choose(s,"format_upper");s=await engine.choose(s,"upper_note");assert.equal(s.competition.rank,"C");assert.equal(s.competition.trials.RANK_C_TO_B.completed,false);});
test("M4_12 registration survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m412-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s.competition.trials.RANK_C_TO_B={checkpointId:"RANK_C_TO_B",fromRank:"C",toRank:"B",requiredRosterSize:4,retryable:true,available:true,registered:false,registeredAtMinutes:null,attempts:0,lastResult:null,bestResult:null,completed:false};s=await engine.choose(s,"go_desk");s=await engine.choose(s,"register_now");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.competition.trials.RANK_C_TO_B.registered,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
