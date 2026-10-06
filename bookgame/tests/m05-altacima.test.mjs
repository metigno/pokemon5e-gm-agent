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
  Object.assign(s.world.flags,{m1_complete:true,m2_complete:true,m03_unlocked:true,m3_complete:true,m04_unlocked:true,m4_active:true,m4_complete:true,m05_unlocked:true,m5_active:true,m5_mountain_approach_complete:true,archie_met:true,friend_beat_04_complete:true,upper_regional_result:"skipped",smuggling_state:"resolved_without_player"});
  s.story.sceneId="m05-altacima";s.story.nodeId="town_entry";s.world.locationId="alt_town";return s;
}

test("M5_02 compiles at 16 nodes and 34 choices",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m05-altacima"];assert.equal(Object.keys(s.nodes).length,16);assert.equal(Object.values(s.nodes).reduce((n,node)=>n+(node.choices?.length??0),0),34);});

test("M5_02 registers Altacima as a reusable Rank B hub",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"entry_register");assert.equal(s.world.flags.altacima_discovered,true);assert.equal(s.story.nodeId,"town_hub");assert.equal(s.world.locationId,"alt_town");
});

test("M5_02 hub exposes distinct services and hides Lance before causal context",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"entry_register");const v=await engine.present(s);for(const id of ["hub_medical","hub_logistics","hub_crest","hub_market","hub_weather","hub_return_mountains"])assert.ok(v.choices.some(c=>c.id===id));assert.equal(v.choices.some(c=>c.id==="hub_lance"),false);
});

test("M5_02 market uses persistent money and finite stock",async()=>{
  const {engine}=await makeEngine();let s=legal();s.player.money=1000;s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_market");s=await engine.choose(s,"market_shop");s=await engine.choose(s,"buy_poke_ball");assert.equal(s.player.money,750);assert.ok(s.player.inventory.includes("poke-ball"));assert.equal(s.shops.altacima_supply.stock["poke-ball"],5);
});

test("M5_02 unaffordable purchases are hidden",async()=>{
  const {engine}=await makeEngine();let s=legal();s.player.money=0;s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_market");s=await engine.choose(s,"market_shop");const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="buy_poke_ball"),false);assert.equal(v.choices.some(c=>c.id==="buy_potion"),false);
});

test("M5_02 clinic information never heals or rewrites roster state",async()=>{
  const {engine}=await makeEngine();let s=legal();s.player.roster=[{id:"a",species:"Growlithe",hp:{current:3,max:20},pp:{ember:1},statuses:["poisoned"]}];const before=structuredClone(s.player.roster);s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_medical");s=await engine.choose(s,"med_info");s=await engine.choose(s,"medinfo_record");assert.deepEqual(s.player.roster,before);assert.equal(s.world.flags.altacima_medical_guidance_known,true);
});

test("M5_02 Trial information does not register RANK_B_TO_A",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_crest");s=await engine.choose(s,"crest_rules");s=await engine.choose(s,"rules_note");assert.equal(s.world.flags.altacima_trial_rules_known,true);assert.equal(s.competition.trials.RANK_B_TO_A,undefined);assert.equal(s.competition.rank,"B");
});

test("M5_02 Lance rumor unlocks causal contact without marking Lance met",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_logistics");s=await engine.choose(s,"log_lance");s=await engine.choose(s,"lance_note");assert.equal(s.world.flags.lance_rumor_heard,true);assert.equal(s.world.flags.lance_met,undefined);const v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="hub_lance"));
});

test("M5_02 weather reading is information, not Fulgore authorization",async()=>{
  const {engine}=await makeEngine();let s=legal();s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_weather");s=await engine.choose(s,"weather_read");assert.equal(s.world.flags.altacima_weather_read,true);assert.equal(s.world.flags.m5_fulgore_departure_ready,undefined);assert.equal(s.world.flags.fulgore_visited,undefined);
});

test("M5_02 save/reload preserves hub and shop state",async()=>{
  let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m502-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=legal();s.player.money=1000;s=await engine.choose(s,"entry_register");s=await engine.choose(s,"hub_market");s=await engine.choose(s,"market_shop");s=await engine.choose(s,"buy_potion");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.shops.altacima_supply.stock.potion,3);}finally{if(dir)await rm(dir,{recursive:true,force:true});}
});
