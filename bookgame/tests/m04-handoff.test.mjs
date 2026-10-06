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
const fixedNow=()=> "2026-10-06T02:00:00.000Z";
async function makeEngine(){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};}

function legal(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="C";s.competition.rankOrder=3;s.player.trainerLevel=8;Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m03_unlocked:true,m3_active:true,m3_complete:true,m04_unlocked:true,steven_met:true,friend_beat_03_complete:true,ferrox_rescue_state:"balanced_support",ferrox_rescue_outcome_complete:true});s.story.sceneId="m04-handoff";s.story.nodeId="m04_entry";s.world.locationId="fer_city";return s;}
test("M4_00 compiles required handoff nodes",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m04-handoff"];for(const n of ["m04_entry","rank_c_band","m3_carryover","rank_c_access_notes"])assert.ok(s.nodes[n]);});
test("M4_00 legal entry exposes activation",async()=>{const {engine}=await makeEngine();const v=await engine.present(legal());assert.ok(v.choices.some(c=>c.id==="activate_m4"));});
test("M4_00 activation writes only m4_active for module start",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"activate_m4");assert.equal(s.world.flags.m4_active,true);assert.equal(s.competition.rank,"C");assert.equal(s.world.flags.m3_complete,true);});
test("M4_00 illegal rank D is blocked",async()=>{const {engine}=await makeEngine();const s=legal();s.competition.rank="D";s.competition.rankOrder=2;await assert.rejects(()=>engine.present(s),/Scene conditions/);});
test("M4_00 missing m3_complete is blocked",async()=>{const {engine}=await makeEngine();const s=legal();delete s.world.flags.m3_complete;await assert.rejects(()=>engine.present(s),/Scene conditions/);});
test("M4_00 missing m04_unlocked is blocked",async()=>{const {engine}=await makeEngine();const s=legal();delete s.world.flags.m04_unlocked;await assert.rejects(()=>engine.present(s),/Scene conditions/);});
test("M4_00 repeated entry is idempotent",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"activate_m4");s.story.sceneId="m04-handoff";s.story.nodeId="m04_entry";const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="m4_already_active"));assert.equal(v.choices.some(c=>c.id==="activate_m4"),false);});
test("M4_00 preserves roster money and M3 callbacks",async()=>{const {engine}=await makeEngine();let s=legal();s.player.money=1234;s.player.roster=[{id:"a",species:"Growlithe",hp:{current:7,max:20},statuses:["poisoned"]}];const roster=structuredClone(s.player.roster);s=await engine.choose(s,"activate_m4");s=await engine.choose(s,"review_m3_state");assert.equal(s.player.money,1234);assert.deepEqual(s.player.roster,roster);assert.equal(s.world.flags.ferrox_rescue_state,"balanced_support");assert.equal(s.world.flags.friend_beat_03_complete,true);});
test("M4_00 travel to Mareasale consumes 240 minutes and changes scene",async()=>{const {engine}=await makeEngine();let s=legal();const before=s.world.elapsedMinutes;s=await engine.choose(s,"activate_m4");s=await engine.choose(s,"travel_mareasale");assert.equal(s.story.sceneId,"m04-mareasale-arrival");assert.equal(s.story.nodeId,"port_approach");assert.equal(s.world.locationId,"mar_city_approach");assert.equal(s.world.elapsedMinutes-before,240);});
test("M4_00 can remain in Ferravia without losing M4 state",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"activate_m4");s=await engine.choose(s,"remain_ferravia");assert.equal(s.story.sceneId,"m03-ferravia-arrival");assert.equal(s.world.flags.m4_active,true);});
test("M4_00 canonical A4 windows become available at Rank C without auto-completing content",async()=>{const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"activate_m4");assert.equal(s.world.flags.a4_league_reg_available,true);assert.equal(s.world.flags.a4_major_name_available,true);assert.equal(s.world.flags.a4_rank_trial_c_b_available,undefined);assert.equal(s.world.flags.upper_regional_result,undefined);});
test("M4_00 A4 C to B Trial window remains gated below trainer level 9",async()=>{const {engine}=await makeEngine();let s=legal();s.player.trainerLevel=8;s=await engine.choose(s,"activate_m4");assert.equal(s.world.flags.a4_rank_trial_c_b_available,undefined);});
test("M4_00 A4 C to B Trial window opens at trainer level 9",async()=>{const {engine}=await makeEngine();let s=legal();s.player.trainerLevel=9;s=await engine.choose(s,"activate_m4");assert.equal(s.world.flags.a4_rank_trial_c_b_available,true);});
test("M4_00 full cross-module link from M3 exit reaches handoff",async()=>{const {engine}=await makeEngine();let s=legal();s.story.sceneId="m03-trial-result";s.story.nodeId="m3_exit_confirmed";s.world.flags.m4_active=undefined;s=await engine.choose(s,"go_to_m04");assert.equal(s.story.sceneId,"m04-handoff");assert.equal(s.story.nodeId,"m04_entry");});
test("M4_00 survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m400-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"activate_m4");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.m4_active,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
