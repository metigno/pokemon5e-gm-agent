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

function cupState(){const s=createNewGameState({protagonist:"Luke",now:fixedNow});s.competition.rank="D";s.competition.rankOrder=2;s.player.roster=roster3();Object.assign(s.world.flags,{m1_complete:true,m02_unlocked:true,m2_active:true,m2_complete:true,m03_unlocked:true,m3_active:true,a3_regional_cup_available:true});s.story.sceneId="m03-regional-cup";s.story.nodeId="cup_board";s.world.locationId="fer_city_arena";return s;}
test("M3_10 compiles full bracket",async()=>{const {bundle}=await makeEngine();const s=bundle.scenes["m03-regional-cup"];for(const n of ["quarterfinal_handoff","semifinal_handoff","final_handoff","cup_close"])assert.ok(s.nodes[n]);});
test("M3_10 registration does not alter rank",async()=>{const {engine}=await makeEngine();let s=cupState();s=await engine.choose(s,"cup_register");assert.equal(s.world.flags.regional_cup_registered,true);assert.equal(s.competition.rank,"D");});
test("M3_10 roster gate prevents official match with fewer than three",async()=>{const {engine}=await makeEngine();let s=cupState();s.player.roster=s.player.roster.slice(0,2);s=await engine.choose(s,"cup_register");const v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="to_qf"),false);});
test("M3_10 quarterfinal is a real E5 official match",async()=>{const {engine}=await makeEngine();let s=cupState();s=await engine.choose(s,"cup_register");s=await engine.choose(s,"to_qf");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");assert.equal(s.pending.competition.type,"official_match");assert.equal(s.pending.competition.officialRosterSize,3);s=await engine.resolveCombatHandoff(s,"win");assert.equal(s.competition.history.at(-1).matchId,"A3_REGIONAL_CUP_QF");assert.equal(s.competition.history.at(-1).outcome,"win");assert.equal(s.competition.rank,"D");});
test("M3_10 loss never advances bracket or rank",async()=>{const {engine}=await makeEngine();let s=cupState();s=await engine.choose(s,"cup_register");s=await engine.choose(s,"to_qf");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");s=await engine.resolveCombatHandoff(s,"lose");assert.equal(s.story.nodeId,"quarterfinal_loss");assert.equal(s.competition.rank,"D");s=await engine.choose(s,"qf_loss_close");s=await engine.choose(s,"elim_qf");assert.equal(s.world.flags.regional_cup_result,"quarterfinal");});
test("M3_10 three real wins produce winner without promotion",async()=>{const {engine}=await makeEngine();let s=cupState();s=await engine.choose(s,"cup_register");s=await engine.choose(s,"to_qf");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"qf_win_continue");s=await engine.choose(s,"qf_post_continue");s=await engine.choose(s,"sf_start");s=await engine.choose(s,"fight_sf");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"sf_win_continue");s=await engine.choose(s,"sf_post_continue");s=await engine.choose(s,"final_start");s=await engine.choose(s,"fight_final");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"final_win_close");assert.equal(s.world.flags.regional_cup_result,"winner");assert.equal(s.world.flags.regional_cup_complete,true);assert.equal(s.competition.history.filter(x=>x.matchId.startsWith("A3_REGIONAL_CUP")).length,3);assert.equal(s.competition.rank,"D");});
test("M3_10 decline is a legal optional completion",async()=>{const {engine}=await makeEngine();let s=cupState();s=await engine.choose(s,"cup_decline");s=await engine.choose(s,"decline_close");assert.equal(s.world.flags.regional_cup_result,"declined");assert.equal(s.world.flags.regional_cup_complete,true);});
test("M3_10 state survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m310-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=cupState();s=await engine.choose(s,"cup_register");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.regional_cup_registered,true);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
