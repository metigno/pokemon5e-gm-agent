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
const fixedNow=()=> "2026-10-06T20:00:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}
function roster(){
  return ["eevee","gastly","totodile","koffing","houndour","shinx"].map((speciesId,index)=>({
    id:"p"+index,speciesId,name:speciesId,level:20,hp:{current:17-index,max:20},
    statuses:{nonVolatile:index===0?"burned":null,remainingRounds:null,flinchedTurns:0},
    abilityId:null,moveIds:[],pp:{}
  }));
}
function base(route="champion"){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot="m12-"+route;
  s.player.trainerLevel=20;
  s.player.roster=roster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.world.locationId="world_village";
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,m7_complete:true,
    m12_unlocked:true,
    m1_world_pressure_player_involved:true,
    m1_world_pressure_local_resolved:true,
    poaching_network_state:"resolved",
    ferrox_outcome_class:"best_contained",
    ferrox_rescue_outcome_complete:true
  });
  if(route==="champion"){
    Object.assign(s.world.flags,{m11_complete:true,world_champion:true,world_eliminated:false,worlds_missed:false,current_world_champion:"Luke",m11_outcome_route:"world_champion"});
    s.competition.world.knockout.finalResolved=true;
    s.competition.world.knockout.playerWonFinal=true;
    s.competition.world.currentWorldChampion={id:"c2060_01_luke",name:"Luke"};
  } else if(route==="eliminated"){
    Object.assign(s.world.flags,{m9_complete:true,world_champion:false,world_eliminated:true,worlds_missed:false,m9_outcome_route:"group_eliminated"});
    s.competition.world.groupStage.resolved=true;
    s.competition.world.groupStage.advanced=false;
    s.competition.world.groupStage.finalPosition=3;
  } else {
    Object.assign(s.world.flags,{m7_complete:true,world_champion:false,world_eliminated:false,worlds_missed:true,world_qualified:false});
  }
  return s;
}

async function openWorldExit(engine,s,route){
  let x=structuredClone(s);
  x.story.sceneId="m12-world-exit-branch";
  x.story.nodeId="world_exit_entry";
  const entry={champion:"enter_champion",eliminated:"enter_eliminated",missed:"enter_missed"}[route];
  x=await engine.choose(x,entry);
  const accept={champion:"champion_accept",eliminated:"eliminated_accept",missed:"missed_accept"}[route];
  x=await engine.choose(x,accept);
  x.story.nodeId="commit_guard";
  x=await engine.choose(x,"commit_now");
  return x;
}

test("M12_00 classifies champion, eliminated and Worlds Missed without changing competition state",async()=>{
  const {engine}=await makeEngine();
  for(const route of ["champion","eliminated","missed"]){
    const before=base(route);
    const competition=structuredClone(before.competition);
    const rosterBefore=structuredClone(before.player.roster);
    const after=await openWorldExit(engine,before,route);
    assert.equal(after.world.flags.m12_world_exit_route,{champion:"world_champion",eliminated:"world_eliminated",missed:"worlds_missed"}[route]);
    assert.equal(after.world.flags.m12_world_exit_branch_complete,true);
    assert.deepEqual(after.competition,competition);
    assert.deepEqual(after.player.roster,rosterBefore);
  }
});

test("M12_00 WORLD_EXIT commit is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=await openWorldExit(engine,base("champion"),"champion");
  s.story.sceneId="m12-world-exit-branch";
  s.story.nodeId="commit_guard";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="commit_now"),false);
  assert.ok(view.choices.some(c=>c.id==="commit_existing"));
  const before=structuredClone(s);
  s=await engine.choose(s,"commit_existing");
  assert.deepEqual(s.competition,before.competition);
  assert.deepEqual(s.player.roster,before.player.roster);
});

test("M12_01 return advances calendar but never heals or rebuilds the roster",async()=>{
  const {engine}=await makeEngine();
  let s=await openWorldExit(engine,base("champion"),"champion");
  const rosterBefore=structuredClone(s.player.roster);
  const competitionBefore=structuredClone(s.competition);
  s.story.sceneId="m12-return-asteria";
  s.story.nodeId="transit_clock";
  const elapsed=s.world.elapsedMinutes;
  s=await engine.choose(s,"travel_standard");
  assert.equal(s.world.elapsedMinutes-elapsed,120);
  assert.deepEqual(s.player.roster,rosterBefore);
  assert.deepEqual(s.competition,competitionBefore);
  s.story.nodeId="public_attention";
  s=await engine.choose(s,"rep_champion");
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_return");
  assert.equal(s.world.flags.m12_return_asteria_complete,true);
  assert.equal(s.world.locationId,"valedarsena_city");
});

test("M12_02 Valedarsena callback reads M1 history and never rewrites it",async()=>{
  const {engine}=await makeEngine();
  let s=await openWorldExit(engine,base("champion"),"champion");
  s.world.flags.m12_return_asteria_complete=true;
  const old={involved:s.world.flags.m1_world_pressure_player_involved,resolved:s.world.flags.m1_world_pressure_local_resolved};
  s.story.sceneId="m12-valedarsena-callbacks";
  s.story.nodeId="callback_synthesis";
  s=await engine.choose(s,"class_resolved");
  assert.equal(s.world.flags.m12_valedarsena_callback_state,"resolved_player_history");
  assert.equal(s.world.flags.m12_valedarsena_callbacks_complete,true);
  assert.equal(s.world.flags.m1_world_pressure_player_involved,old.involved);
  assert.equal(s.world.flags.m1_world_pressure_local_resolved,old.resolved);
  assert.equal(s.world.locationId,"borgo_salice");
});

test("M12_03 Bruma callback preserves the actual M2 network outcome",async()=>{
  const {engine}=await makeEngine();
  let s=base("eliminated");
  Object.assign(s.world.flags,{m12_world_exit_branch_complete:true,m12_return_asteria_complete:true,m12_valedarsena_callbacks_complete:true,poaching_network_state:"ignored"});
  s.story.sceneId="m12-bruma-callbacks";
  s.story.nodeId="callback_synthesis";
  s=await engine.choose(s,"class_ignored");
  assert.equal(s.world.flags.poaching_network_state,"ignored");
  assert.equal(s.world.flags.m12_bruma_callback_state,"ignored_or_offscreen");
  assert.equal(s.world.flags.m12_bruma_callbacks_complete,true);
  assert.equal(s.world.locationId,"fer_city");
});

test("M12_04 Ferrox callback classifies real rescue history and closes Cycle 1 only",async()=>{
  const {engine}=await makeEngine();
  let s=base("missed");
  Object.assign(s.world.flags,{m12_world_exit_branch_complete:true,m12_return_asteria_complete:true,m12_valedarsena_callbacks_complete:true,m12_bruma_callbacks_complete:true,ferrox_outcome_class:"player_declined"});
  s.story.sceneId="m12-ferrox-callbacks";
  s.story.nodeId="callback_synthesis";
  s=await engine.choose(s,"class_late");
  assert.equal(s.world.flags.ferrox_outcome_class,"player_declined");
  assert.equal(s.world.flags.m12_ferrox_callback_state,"late_or_declined_history");
  assert.equal(s.world.flags.m12_ferrox_callbacks_complete,true);
  assert.equal(s.world.flags.m12_cycle1_complete,true);
  assert.notEqual(s.world.flags.m12_complete,true);
  assert.notEqual(s.world.flags.main_story_complete,true);
});

test("M12 Cycle 1 survives save/reload with prior campaign state intact",async()=>{
  let dir;
  try{
    const {engine}=await makeEngine();
    let s=await openWorldExit(engine,base("champion"),"champion");
    s.world.flags.m12_return_asteria_complete=true;
    s.world.flags.m12_valedarsena_callbacks_complete=true;
    s.world.flags.m12_bruma_callbacks_complete=true;
    s.story.sceneId="m12-ferrox-callbacks";
    s.story.nodeId="callback_synthesis";
    s=await engine.choose(s,"class_contained");
    const snapshot={competition:structuredClone(s.competition),roster:structuredClone(s.player.roster),flags:structuredClone(s.world.flags)};
    dir=await mkdtemp(path.join(os.tmpdir(),"m12c1-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load(s.slot);
    assert.deepEqual(loaded.competition,snapshot.competition);
    assert.deepEqual(loaded.player.roster,snapshot.roster);
    assert.deepEqual(loaded.world.flags,snapshot.flags);
    assert.equal(loaded.world.flags.m12_cycle1_complete,true);
  }finally{
    if(dir) await rm(dir,{recursive:true,force:true});
  }
});
