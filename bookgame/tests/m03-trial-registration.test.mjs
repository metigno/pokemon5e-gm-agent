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

function regState(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="D";s.competition.rankOrder=2;s.player.roster=roster3();Object.assign(s.world.flags,{m1_complete:true,m02_unlocked:true,m2_active:true,m2_complete:true,m03_unlocked:true,m3_active:true,ferravia_discovered:true,a3_rank_trial_d_c_available:true});s.story.sceneId="m03-ferravia-arrival";s.story.nodeId="city_hub";s.world.locationId="fer_city";return s;}
test("M3_12 Ferravia hub opens canonical D to C Trial state",async()=>{const {engine}=await makeEngine();let s=regState();s=await engine.choose(s,"hub_trial_d_c");const t=s.competition.trials.RANK_D_TO_C;assert.equal(t.available,true);assert.equal(t.fromRank,"D");assert.equal(t.toRank,"C");assert.equal(t.requiredRosterSize,3);assert.equal(t.retryable,true);});
test("M3_12 register uses E5 and keeps Rank D",async()=>{const {engine}=await makeEngine();let s=regState();s=await engine.choose(s,"hub_trial_d_c");s=await engine.choose(s,"go_desk");s=await engine.choose(s,"register_now");assert.equal(s.competition.trials.RANK_D_TO_C.registered,true);assert.equal(s.competition.rank,"D");});
test("M3_12 registration is hidden with roster below three",async()=>{const {engine}=await makeEngine();let s=regState();s.player.roster=s.player.roster.slice(0,2);s=await engine.choose(s,"hub_trial_d_c");s=await engine.choose(s,"go_desk");const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="register_now"),false);});
test("M3_12 registered state can enter M3_13",async()=>{const {engine}=await makeEngine();let s=regState();s=await engine.choose(s,"hub_trial_d_c");s=await engine.choose(s,"go_desk");s=await engine.choose(s,"register_now");s=await engine.choose(s,"enter_trial");assert.equal(s.story.sceneId,"m03-promotion-trial-d-c");});
test("M3_12 postponing does not consume an attempt",async()=>{const {engine}=await makeEngine();let s=regState();s=await engine.choose(s,"hub_trial_d_c");s=await engine.choose(s,"postpone");assert.equal(s.competition.trials.RANK_D_TO_C.attempts,0);});
test("M3_12 registration survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m312-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=regState();s=await engine.choose(s,"hub_trial_d_c");s=await engine.choose(s,"go_desk");s=await engine.choose(s,"register_now");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.equal(l.competition.trials.RANK_D_TO_C.registered,true);assert.equal(l.competition.rank,"D");}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
