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

function outState(kind="balanced_support"){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="D";s.competition.rankOrder=2;Object.assign(s.world.flags,{m1_complete:true,m02_unlocked:true,m2_active:true,m2_complete:true,m03_unlocked:true,m3_active:true,ferrox_rescue_state:kind,ferrox_warning_quality:"strong",ferrox_warning_notice_specific:true});s.story.sceneId="m03-rescue-outcome";s.story.nodeId="outcome_board";s.world.locationId="fer_city";return s;}
test("M3_11 compiles all rescue-state outcomes",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m03-rescue-outcome"];for(const n of ["balanced_outcome","evac_outcome","stable_outcome","support_outcome","missed_outcome","declined_outcome"])assert.ok(s.nodes[n]);});
test("M3_11 balanced route persists people and damage outcome",async()=>{const {engine}=await makeEngine();let s=outState();s=await engine.choose(s,"outcome_balanced");s=await engine.choose(s,"balanced_register");assert.equal(s.world.flags.ferrox_people_outcome,"all_accounted_injuries_noncritical");assert.equal(s.world.flags.ferrox_damage_state,"contained_section_closure");});
test("M3_11 missed route does not fabricate player causation",async()=>{const {engine}=await makeEngine();let s=outState("missed");s=await engine.choose(s,"outcome_missed");s=await engine.choose(s,"missed_register");assert.equal(s.world.flags.ferrox_outcome_class,"window_missed");assert.equal(s.world.flags.ferrox_responsibility_state,undefined);});
test("M3_11 responsibility requires an authored interpretation choice",async()=>{const {engine}=await makeEngine();let s=outState("evacuation_supported");s=await engine.choose(s,"outcome_evac");s=await engine.choose(s,"evac_register");s=await engine.choose(s,"resp_systemic");assert.equal(s.world.flags.ferrox_responsibility_state,"systemic_shared");});
test("M3_11 closes with qualitative local reputation only",async()=>{const {engine}=await makeEngine();let s=outState();s=await engine.choose(s,"outcome_balanced");s=await engine.choose(s,"balanced_register");s=await engine.choose(s,"resp_systemic");s=await engine.choose(s,"rep_high");s=await engine.choose(s,"close_hub");assert.equal(s.world.flags.ferrox_local_reputation_outcome,"trusted_responder");assert.equal(s.world.flags.ferrox_rescue_outcome_complete,true);});
test("M3_11 is blocked after completion",async()=>{const {engine}=await makeEngine();const s=outState();s.world.flags.ferrox_rescue_outcome_complete=true;await assert.rejects(()=>engine.present(s),/Scene conditions/);});
test("M3_11 survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m311-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=outState("support_only");s=await engine.choose(s,"outcome_support");s=await engine.choose(s,"support_register");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
