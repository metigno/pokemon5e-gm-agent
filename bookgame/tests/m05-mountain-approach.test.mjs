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
const fixedNow=()=> "2026-10-06T07:30:00.000Z";
async function makeEngine(){const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});const scenes={async load(id){return structuredClone(bundle.scenes[id]);},async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},async loadEcology(){return structuredClone(bundle.ecology);}};return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};}
function legal(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.competition.rank="B";s.competition.rankOrder=4;s.player.trainerLevel=11;
  Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m03_unlocked:true,m3_complete:true,m04_unlocked:true,m4_active:true,m4_complete:true,m05_unlocked:true,m5_active:true,archie_met:true,friend_beat_04_complete:true,upper_regional_result:"skipped",smuggling_state:"resolved_without_player",ferrox_rescue_state:"balanced_support"});
  s.story.sceneId="m05-mountain-approach";s.story.nodeId="mountain_departure";s.world.locationId="fer_mountains";return s;
}

test("M5_01 compiles at 16 nodes and 34 choices",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m05-mountain-approach"];assert.equal(Object.keys(s.nodes).length,16);assert.equal(Object.values(s.nodes).reduce((n,node)=>n+(node.choices?.length??0),0),34);});

test("M5_01 exposes service and high routes without changing Rank",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"dep_board");let v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="board_service"));assert.ok(v.choices.some(c=>c.id==="board_high"));s=await engine.choose(s,"board_service");assert.equal(s.world.flags.m5_mountain_route,"service_road");assert.equal(s.competition.rank,"B");
});

test("M5_01 service route consumes real time",async()=>{
  const {engine}=await makeEngine();let s=legal();const before=s.world.elapsedMinutes;s=await engine.choose(s,"dep_board");s=await engine.choose(s,"board_service");assert.equal(s.world.elapsedMinutes-before,120);
});

test("M5_01 high trail is a distinct persistent route",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"dep_board");s=await engine.choose(s,"board_high");assert.equal(s.world.flags.m5_mountain_route,"high_trail");assert.equal(s.story.nodeId,"upper_trail");
});

test("M5_01 shelter waiting advances the shared clock",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.nodeId="shelter";const before=s.world.elapsedMinutes;s=await engine.choose(s,"sh_wait");assert.equal(s.world.elapsedMinutes-before,60);assert.equal(s.story.nodeId,"ridge_choice");
});

test("M5_01 Ferrox callback is conditional on real history",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.nodeId="callback_rescue";let v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="cb_known"));
  const without=legal();delete without.world.flags.ferrox_rescue_state;without.story.nodeId="callback_rescue";v=await engine.present(without);assert.equal(v.choices.some(c=>c.id==="cb_known"),false);assert.ok(v.choices.some(c=>c.id==="cb_neutral"));
});

test("M5_01 retreat returns to Mareasale without marking approach complete",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"dep_retreat");s=await engine.choose(s,"ret_hub");assert.equal(s.story.sceneId,"m04-mareasale-arrival");assert.equal(s.world.flags.m5_active,true);assert.equal(s.world.flags.m5_mountain_approach_complete,undefined);
});

test("M5_01 Altacima gate confirms access but does not promote",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.nodeId="arrival_gate";s=await engine.choose(s,"gate_enter");assert.equal(s.world.flags.altacima_access_confirmed,true);assert.equal(s.world.locationId,"alt_town");assert.equal(s.competition.rank,"B");
});

test("M5_01 close enters Altacima and persists completion",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.nodeId="approach_close";s=await engine.choose(s,"close_altacima");assert.equal(s.story.sceneId,"m05-altacima");assert.equal(s.story.nodeId,"town_entry");assert.equal(s.world.flags.m5_mountain_approach_complete,true);assert.equal(s.world.locationId,"alt_town");
});

test("M5_01 save/reload preserves chosen mountain route",async()=>{
  let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m501-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"dep_board");s=await engine.choose(s,"board_high");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.m5_mountain_route,"high_trail");}finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
