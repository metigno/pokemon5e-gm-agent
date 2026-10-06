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

function state(){const s=base();s.world.flags.a4_major_name_available=true;s.story.sceneId="m04-major-name";s.story.nodeId="major_arrival";return s;}
test("M4_10 compiles wider-world Maxie scene",async()=>{const {bundle}=await makeEngine();const x=bundle.scenes["m04-major-name"];for(const n of ["major_arrival","maxie_intro","infrastructure_talk","archie_history","smuggling_context","competition_context","major_close"])assert.ok(x.nodes[n]);});
test("M4_10 direct introduction registers persistent Maxie",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"approach_maxie");assert.equal(s.world.flags.maxie_met,true);assert.equal(s.npcs.Maxie.name,"Maxie");assert.equal(s.npcs.Maxie.state.role,"wider_world_trainer");});
test("M4_10 observation-only route still persists the named trainer",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"observe_first");s=await engine.choose(s,"obs_note");assert.ok(s.npcs.Maxie);assert.equal(s.npcs.Maxie.state.seenAtMareasale,true);assert.equal(s.world.flags.maxie_met,undefined);});
test("M4_10 relationship answers do not change Rank or competition history",async()=>{const {engine}=await makeEngine();let s=state();const h=s.competition.history.length;s=await engine.choose(s,"approach_maxie");s=await engine.choose(s,"answer_context");assert.equal(s.competition.rank,"C");assert.equal(s.competition.history.length,h);assert.ok(s.npcs.Maxie.relationship.score>0);});
test("M4_10 Archie callback requires Archie actually met",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"approach_maxie");s=await engine.choose(s,"answer_context");let v=await engine.present(s);assert.equal(v.choices.some(c=>c.id==="ask_archie_history"),false);s.world.flags.archie_met=true;v=await engine.present(s);assert.ok(v.choices.some(c=>c.id==="ask_archie_history"));});
test("M4_10 completion records Character Bible identity without battle",async()=>{const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"approach_maxie");s=await engine.choose(s,"answer_control");s=await engine.choose(s,"close_infra");s=await engine.choose(s,"complete_major_name");assert.equal(s.world.flags.major_name_complete,true);assert.equal(s.world.flags.major_name_id,"Maxie");assert.equal(s.pending,null);});
test("M4_10 survives save/reload",async()=>{let dir;try{dir=await mkdtemp(path.join(os.tmpdir(),"m410-"));const store=new SaveStore(dir);const {engine}=await makeEngine();let s=state();s=await engine.choose(s,"approach_maxie");s=await engine.choose(s,"answer_context");s.slot="slot1";await store.save(s);const l=await store.load("slot1");assert.deepEqual(l,s);assert.ok(l.npcs.Maxie);}finally{if(dir)await rm(dir,{recursive:true,force:true});}});
