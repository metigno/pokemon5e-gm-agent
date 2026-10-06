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

function state(){const s=base();s.competition.trials.RANK_C_TO_B={checkpointId:"RANK_C_TO_B",fromRank:"C",toRank:"B",requiredRosterSize:4,retryable:true,available:true,registered:true,registeredAtMinutes:s.world.elapsedMinutes,attempts:0,lastResult:null,bestResult:null,completed:false};s.story.sceneId="m04-promotion-trial-c-b";s.story.nodeId="trial_gate_call";s.world.locationId="mar_city_arena";return s;}
test("M4_13 compiles ELITE C to B checkpoint",async()=>{const {bundle}=await makeEngine();const x=bundle.scenes["m04-promotion-trial-c-b"];for(const n of ["trial_gate_call","examiner_briefing","trial_win","trial_loss","retry_choice"])assert.ok(x.nodes[n]);});
test("M4_13 begin_trial creates canonical metadata and increments attempt",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");assert.equal(s.pending.competition.checkpointId,"RANK_C_TO_B");assert.equal(s.pending.competition.fromRank,"C");assert.equal(s.pending.competition.toRank,"B");assert.equal(s.pending.competition.officialRosterSize,4);assert.equal(s.pending.competition.difficulty,"ELITE");assert.equal(s.competition.trials.RANK_C_TO_B.attempts,1);});
test("M4_13 win promotes only through E5 and keeps result scene legal",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s=await engine.resolveCombatHandoff(s,"win");assert.equal(s.competition.rank,"B");assert.equal(s.competition.rankOrder,4);assert.equal(s.competition.trials.RANK_C_TO_B.completed,true);assert.equal(s.competition.trials.RANK_C_TO_B.available,false);assert.equal(s.story.nodeId,"trial_win");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="win_after"));});
test("M4_13 loss remains Rank C and reopens retry",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s=await engine.resolveCombatHandoff(s,"lose");assert.equal(s.competition.rank,"C");assert.equal(s.competition.trials.RANK_C_TO_B.available,true);assert.equal(s.competition.trials.RANK_C_TO_B.registered,false);assert.equal(s.story.nodeId,"trial_loss");});
test("M4_13 loss does not reset earlier M4 state",async()=>{const {engine}=await makeEngine();let s=state();Object.assign(s.world.flags,{archie_met:true,friend_beat_04_complete:true,smuggling_state:"customs_monitoring",upper_regional_result:"winner"});s.player.money=777;const roster=structuredClone(s.player.roster);s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s=await engine.resolveCombatHandoff(s,"lose");assert.equal(s.world.flags.archie_met,true);assert.equal(s.world.flags.friend_beat_04_complete,true);assert.equal(s.world.flags.smuggling_state,"customs_monitoring");assert.equal(s.world.flags.upper_regional_result,"winner");assert.equal(s.player.money,777);assert.deepEqual(s.player.roster,roster);});
test("M4_13 pending Trial survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m413-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"briefing");s=await engine.choose(s,"begin_trial");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.equal(l.pending.competition.checkpointId,"RANK_C_TO_B");assert.equal(l.competition.trials.RANK_C_TO_B.attempts,1);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
