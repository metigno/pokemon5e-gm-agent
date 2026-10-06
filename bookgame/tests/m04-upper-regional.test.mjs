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

function state(){const s=base();Object.assign(s.world.flags,{upper_regional_registration_complete:true,upper_regional_registration_status:"registered",a4_regional_league_available:true});s.story.sceneId="m04-upper-regional";s.story.nodeId="circuit_board";s.world.locationId="mar_city_arena";return s;}
async function winMatch(engine,s,startChoice,fightChoice,nextChoice){s=await engine.choose(s,startChoice);s=await engine.choose(s,fightChoice);s=await engine.resolveCombatHandoff(s,"win");if(nextChoice)s=await engine.choose(s,nextChoice);return s;}
test("M4_11 compiles all three official rounds",async()=>{const {bundle}=await makeEngine();const x=bundle.scenes["m04-upper-regional"];for(const n of ["qf_handoff","sf_handoff","final_handoff","circuit_result"])assert.ok(x.nodes[n]);});
test("M4_11 quarterfinal is real E5 official Singles with roster four",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"start_upper");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");assert.equal(s.pending.competition.type,"official_match");assert.equal(s.pending.competition.officialRosterSize,4);assert.equal(s.pending.competition.format,"Singles");s=await engine.resolveCombatHandoff(s,"win");assert.equal(s.competition.history.at(-1).matchId,"A4_UPPER_REGIONAL_QF");assert.equal(s.competition.rank,"C");});
test("M4_11 quarterfinal loss produces quarterfinal result without promotion",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"start_upper");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");s=await engine.resolveCombatHandoff(s,"lose");s=await engine.choose(s,"qf_loss_close");assert.equal(s.world.flags.upper_regional_result,"quarterfinal");assert.equal(s.world.flags.upper_regional_complete,true);assert.equal(s.competition.rank,"C");});
test("M4_11 three real wins produce winner and exactly three E5 records",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"start_upper");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"qf_win_continue");s=await engine.choose(s,"qf_post_sf");s=await engine.choose(s,"sf_start");s=await engine.choose(s,"fight_sf");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"sf_win_final");s=await engine.choose(s,"sf_post_final");s=await engine.choose(s,"final_start");s=await engine.choose(s,"fight_final");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"final_win_close");assert.equal(s.world.flags.upper_regional_result,"winner");assert.equal(s.competition.history.filter(x=>x.matchId.startsWith("A4_UPPER_REGIONAL")).length,3);assert.equal(s.competition.rank,"C");});
test("M4_11 pre-match withdrawal fabricates no official match",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"withdraw_before_start");s=await engine.choose(s,"confirm_withdraw");assert.equal(s.world.flags.upper_regional_result,"withdrew");assert.equal(s.competition.history.length,0);});
test("M4_11 forfeit before QF fight fabricates no E5 record",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"start_upper");s=await engine.choose(s,"qf_forfeit");assert.equal(s.world.flags.upper_regional_result,"forfeited");assert.equal(s.competition.history.length,0);});
test("M4_11 result activates A4_AFTER_LEAGUE through Living World",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"withdraw_before_start");s=await engine.choose(s,"confirm_withdraw");assert.equal(s.world.flags.a4_after_league_available,true);assert.equal(s.events.A4_AFTER_LEAGUE.status,"resolved");});
test("M4_11 survives save/reload mid-bracket",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m411-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"start_upper");s=await engine.choose(s,"qf_start");s=await engine.choose(s,"fight_qf");s=await engine.resolveCombatHandoff(s,"win");s=await engine.choose(s,"qf_win_continue");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.equal(l.world.flags.upper_regional_qf_result,"win");}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
