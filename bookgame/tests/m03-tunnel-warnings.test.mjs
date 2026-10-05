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
const fixedNow=()=> "2026-10-05T18:00:00.000Z";

async function makeEngine(dice=new SequenceDice([1])){
 const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
 const scenes={
  async load(id){return structuredClone(bundle.scenes[id]);},
  async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
  async loadEcology(){return structuredClone(bundle.ecology);}
 };
 return {engine:new BookgameEngine({scenes,dice,now:fixedNow}),bundle};
}
function legal(){
 const s=createNewGameState({protagonist:"Luke",now:fixedNow});
 s.competition.rank="D"; s.competition.rankOrder=2;
 Object.assign(s.world.flags,{m1_complete:true,m02_unlocked:true,m2_active:true,m2_complete:true,m03_unlocked:true,m3_active:true,ferravia_discovered:true,old_maps_read:true,steven_met:true});
 s.story.sceneId="m03-tunnel-warnings"; s.story.nodeId="warning_board"; s.world.locationId="ferrox_access";
 return s;
}

test("M3_05 compiles with warning graph",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m03-tunnel-warnings"];assert.ok(s);assert.ok(s.nodes.warning_synthesis);assert.ok(s.nodes.warning_close);});
test("M3_05 rejects Rank E",async()=>{const {engine}=await makeEngine();const s=legal();s.competition.rank="E";await assert.rejects(()=>engine.present(s),/Scene conditions/);});
test("M3_05 old-map callback is visible only with prior knowledge",async()=>{const {engine}=await makeEngine();let s=legal();let v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="compare_old_maps"));delete s.world.flags.old_maps_read;v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="compare_old_maps"),false);});
test("M3_05 successful notice investigation records specific warning",async()=>{const {engine}=await makeEngine(new SequenceDice([20]));let s=legal();s=await engine.choose(s,"inspect_notice");assert.equal(s.story.nodeId,"notice_clear");assert.equal(s.world.flags.ferrox_warning_notice_specific,true);});
test("M3_05 failed notice investigation stays partial",async()=>{const {engine}=await makeEngine(new SequenceDice([1]));let s=legal();s=await engine.choose(s,"inspect_notice");assert.equal(s.story.nodeId,"notice_partial");assert.equal(s.world.flags.ferrox_warning_notice_partial,true);});
test("M3_05 physical inspection can create structural signal",async()=>{const {engine}=await makeEngine(new SequenceDice([20]));let s=legal();s=await engine.choose(s,"walk_permitted_route");assert.equal(s.world.flags.ferrox_warning_structural_signal,true);});
test("M3_05 worker persuasion has a real success/failure fork",async()=>{let {engine}=await makeEngine(new SequenceDice([20]));let s=legal();s=await engine.choose(s,"ask_worker");s=await engine.choose(s,"worker_persuade");assert.equal(s.story.nodeId,"worker_open");({engine}=await makeEngine(new SequenceDice([1])));s=legal();s=await engine.choose(s,"ask_worker");s=await engine.choose(s,"worker_persuade");assert.equal(s.story.nodeId,"worker_guarded");});
test("M3_05 Steven callback does not fabricate contact",async()=>{const {engine}=await makeEngine();let s=legal();delete s.world.flags.steven_met;const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="ask_steven"),false);});
test("M3_05 strong synthesis starts the real timed Ferrox rescue through world event",async()=>{const {engine}=await makeEngine(new SequenceDice([20]));let s=legal();s=await engine.choose(s,"inspect_notice");s=await engine.choose(s,"notice_to_board");s=await engine.choose(s,"walk_permitted_route");s=await engine.choose(s,"structural_synthesis");s=await engine.choose(s,"record_converging_warnings");assert.equal(s.world.flags.ferrox_warning_quality,"strong");assert.equal(s.world.flags.a3_ferrox_incident_available,true);assert.equal(s.world.flags.ferrox_incident_started,true);assert.equal(s.quests.M3_FERROX_RESCUE.status,"active");assert.ok(Number.isInteger(s.quests.M3_FERROX_RESCUE.deadlineAtMinutes));});
test("M3_05 low-confidence route remains legal and still lets world move",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"synthesize_now");s=await engine.choose(s,"record_low_confidence");assert.equal(s.world.flags.ferrox_warning_quality,"low");assert.equal(s.world.flags.tunnel_warnings_complete,true);assert.equal(s.quests.M3_FERROX_RESCUE.status,"active");});
test("M3_05 incident alert is available from close after the world event fires",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"synthesize_now");s=await engine.choose(s,"record_low_confidence");const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="open_incident_alert"));});
test("M3_05 does not change rank, roster or money",async()=>{const {engine}=await makeEngine();let s=legal();s.player.money=900;const roster=structuredClone(s.player.roster);s=await engine.choose(s,"compare_old_maps");s=await engine.choose(s,"old_map_board");assert.equal(s.competition.rank,"D");assert.equal(s.player.money,900);assert.deepEqual(s.player.roster,roster);});
test("M3_05 re-entry preserves warning evidence",async()=>{const {engine}=await makeEngine(new SequenceDice([20]));let s=legal();s=await engine.choose(s,"inspect_notice");s.story.nodeId="warning_board";const v=await engine.present(s);assert.equal(v.nodeId,"warning_board");assert.equal(s.world.flags.ferrox_warning_notice_specific,true);});
test("M3_05 state survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m305-"));const store=new SaveStore(dir);const {engine}=await makeEngine(new SequenceDice([20]));let s=legal();s=await engine.choose(s,"walk_permitted_route");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.ferrox_warning_structural_signal,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
