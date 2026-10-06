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
  Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m03_unlocked:true,m3_complete:true,m04_unlocked:true,m4_active:true,m4_complete:true,m05_unlocked:true,m5_active:true,altacima_discovered:true,archie_met:true,friend_beat_04_complete:true,upper_regional_result:"skipped",smuggling_state:"resolved_without_player",ferrox_rescue_state:"balanced_support"});
  s.story.sceneId="m05-lance-enters";s.story.nodeId="crest_intro";s.world.locationId="alt_town_crest";return s;
}

test("M5_03 compiles at 15 nodes and 34 choices",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m05-lance-enters"];assert.equal(Object.keys(s.nodes).length,15);assert.equal(Object.values(s.nodes).reduce((n,node)=>n+(node.choices?.length??0),0),34);});

test("M5_03 first meeting registers persistent Lance",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_introduce");assert.equal(s.world.flags.lance_met,true);assert.equal(s.npcs.Lance.name,"Lance");assert.equal(s.npcs.Lance.state.role,"high_altitude_anchor");
});

test("M5_03 observing first can defer without forcing Lance met",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_observe");s=await engine.choose(s,"observe_leave");assert.equal(s.world.flags.lance_met,undefined);assert.equal(s.world.flags.lance_contact_deferred,true);
});

test("M5_03 deferred path can recover mandatory first meeting",async()=>{
  const {engine}=await makeEngine();let s=legal();s.story.nodeId="deferred_intro";s.world.flags.lance_contact_deferred=true;s=await engine.choose(s,"deferred_introduce");assert.equal(s.world.flags.lance_met,true);assert.equal(s.world.flags.lance_contact_recovered,true);assert.ok(s.npcs.Lance);
});

test("M5_03 repeated encounter does not duplicate first introduction",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_introduce");s.story.sceneId="m05-lance-enters";s.story.nodeId="crest_intro";const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="crest_reengage"));assert.equal(v.choices.some(c=>c.id==="crest_introduce"),false);
});

test("M5_03 risk discussion can change relationship and persist common ground",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_introduce");const before=s.npcs.Lance.relationship.score;s=await engine.choose(s,"ask_risk");s=await engine.choose(s,"risk_agree");assert.ok(s.npcs.Lance.relationship.score>before);assert.equal(s.world.flags.lance_risk_common_ground,true);
});

test("M5_03 career discussion records stage-aware principle only",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_introduce");s=await engine.choose(s,"ask_career");s=await engine.choose(s,"dragon_record");assert.equal(s.world.flags.lance_stage_aware_principle_known,true);assert.equal(s.npcs.Lance.state.form,undefined);assert.equal(s.npcs.Lance.state.ace,undefined);
});

test("M5_03 never changes Rank, roster or money",async()=>{
  const {engine}=await makeEngine();let s=legal();s.player.money=777;s.player.roster=[{id:"a",species:"Growlithe"}];const roster=structuredClone(s.player.roster);s=await engine.choose(s,"crest_introduce");s=await engine.choose(s,"ask_risk");assert.equal(s.competition.rank,"B");assert.equal(s.player.money,777);assert.deepEqual(s.player.roster,roster);assert.equal(s.world.flags.interregional_license,undefined);
});

test("M5_03 closes back into the persistent Altacima hub",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_introduce");s=await engine.choose(s,"ask_risk");s=await engine.choose(s,"risk_agree");s=await engine.choose(s,"weather_margin");s=await engine.choose(s,"route_note");s=await engine.choose(s,"state_close");s=await engine.choose(s,"close_hub");assert.equal(s.story.sceneId,"m05-altacima");assert.equal(s.story.nodeId,"town_hub");assert.equal(s.world.locationId,"alt_town");
});

test("M5_03 save/reload preserves Lance relationship and first meeting",async()=>{
  let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m503-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"crest_introduce");s=await engine.choose(s,"ask_risk");s=await engine.choose(s,"risk_agree");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.lance_met,true);assert.ok(l.npcs.Lance);}finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
