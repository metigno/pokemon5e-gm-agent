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
const fixedNow=()=> "2026-10-06T15:00:00.000Z";

async function makeEngine(){
  const bundle=await compileStory({scenesDir,modulesDir,eventsDir,ecologyOptions});
  const scenes={
    async load(id){return structuredClone(bundle.scenes[id]);},
    async loadWorldEvents(){return structuredClone(bundle.worldEvents??[]);},
    async loadEcology(){return structuredClone(bundle.ecology);}
  };
  return {engine:new BookgameEngine({scenes,now:fixedNow}),bundle};
}

function sixRoster(){
  const species=["eevee","gastly","totodile","koffing","houndour","shinx"];
  return species.map((speciesId,index)=>({
    id:"player_"+index,speciesId,name:speciesId,level:20,
    hp:{current:20-index,max:20},
    statuses:{nonVolatile:null,remainingRounds:null,flinchedTurns:0},
    abilityId:null,moveIds:[],pp:{}
  }));
}

function participant(id,name){return {id,name};}

function advancedState(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot="slot-m9-final";
  s.player.trainerLevel=20;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.world.locationId="world_village";
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,m7_complete:true,m8_complete:true,
    m09_unlocked:true,m9_active:true,m9_groups_open_complete:true,m9_matchday_one_complete:true,m9_interday_one_complete:true,
    m9_kaia_thread_complete:true,m9_matchday_two_complete:true,friend_beat_09_complete:true,m9_interday_two_complete:true,
    m9_matchday_three_complete:true,m9_group_resolution_complete:true,m9_advance_route_available:true,
    world_qualified:true,world_draw_complete:true,world_field_32_locked:true,world_group_stage_open:true,
    world_group_md1_resolved:true,world_group_md2_resolved:true,world_group_md3_resolved:true,
    world_group_stage_resolved:true,world_group_advanced:true,world_eliminated:false,world_top16_locked:true
  });
  const Luke=participant("c2060_01_luke","Luke");
  const Red=participant("c2060_09_red","Red");
  const Kaia=participant("c2060_32_kaia_solari","Kaia Solari");
  const Fab=participant("c2060_05_fab","Fab");
  const A=[Luke,Red,Kaia,Fab];
  const labels="ABCDEFGH".split("");
  const groups={A};
  let n=100;
  for(const label of labels.slice(1)){
    groups[label]=[0,1,2,3].map(()=>participant("npc_"+n,"Trainer "+n++));
  }
  const field=Object.values(groups).flat();
  s.competition.world.drawComplete=true;
  s.competition.world.fieldLocked=true;
  s.competition.world.field=structuredClone(field);
  s.competition.world.seedOrder=structuredClone(field);
  s.competition.world.groups=structuredClone(groups);
  s.competition.world.playerGroup="A";
  s.competition.world.playerOpponents=[Red,Kaia,Fab];
  s.competition.world.top16Locked=true;
  s.competition.world.top16=[
    {participantId:Luke.id,name:Luke.name,group:"A",groupPosition:1,points:9},
    {participantId:Red.id,name:Red.name,group:"A",groupPosition:2,points:6},
    ...labels.slice(1).flatMap((label)=>groups[label].slice(0,2).map((p,index)=>({
      participantId:p.id,name:p.name,group:label,groupPosition:index+1,points:index===0?9:6
    })))
  ];
  s.competition.world.groupStage.opened=true;
  s.competition.world.groupStage.playerGroup="A";
  s.competition.world.groupStage.participants=structuredClone(A);
  s.competition.world.groupStage.playerMatches=[
    {matchday:1,matchId:"WORLD_GROUP_MD1",homeId:Luke.id,homeName:Luke.name,awayId:Red.id,awayName:Red.name,opponentId:Red.id,opponentName:Red.name,outcome:"win",resolvedAtMinutes:100},
    {matchday:2,matchId:"WORLD_GROUP_MD2",homeId:Luke.id,homeName:Luke.name,awayId:Kaia.id,awayName:Kaia.name,opponentId:Kaia.id,opponentName:Kaia.name,outcome:"win",resolvedAtMinutes:200},
    {matchday:3,matchId:"WORLD_GROUP_MD3",homeId:Luke.id,homeName:Luke.name,awayId:Fab.id,awayName:Fab.name,opponentId:Fab.id,opponentName:Fab.name,outcome:"win",resolvedAtMinutes:300}
  ];
  s.competition.world.groupStage.offscreenMatches=[
    {matchday:1,matchId:"OFF1",homeId:Kaia.id,homeName:Kaia.name,awayId:Fab.id,awayName:Fab.name,outcome:"win"},
    {matchday:2,matchId:"OFF2",homeId:Red.id,homeName:Red.name,awayId:Fab.id,awayName:Fab.name,outcome:"win"},
    {matchday:3,matchId:"OFF3",homeId:Red.id,homeName:Red.name,awayId:Kaia.id,awayName:Kaia.name,outcome:"win"}
  ];
  s.competition.world.groupStage.standings=[
    {participantId:Luke.id,name:Luke.name,played:3,wins:3,losses:0,points:9,headToHeadPoints:0,seedIndex:0},
    {participantId:Red.id,name:Red.name,played:3,wins:2,losses:1,points:6,headToHeadPoints:0,seedIndex:1},
    {participantId:Kaia.id,name:Kaia.name,played:3,wins:1,losses:2,points:3,headToHeadPoints:0,seedIndex:2},
    {participantId:Fab.id,name:Fab.name,played:3,wins:0,losses:3,points:0,headToHeadPoints:0,seedIndex:3}
  ];
  s.competition.world.groupStage.playerPosition=1;
  s.competition.world.groupStage.playerPoints=9;
  s.competition.world.groupStage.finalPosition=1;
  s.competition.world.groupStage.advanced=true;
  s.competition.world.groupStage.resolved=true;
  return s;
}

test("M9_10 entry requires resolved advanced Top16 state",async()=>{
  const {engine}=await makeEngine();
  let s=advancedState();
  s.story.sceneId="m09-advance-route";s.story.nodeId="advance_entry";
  let view=await engine.present(s);
  assert.equal(view.sceneId,"m09-advance-route");
  s=advancedState();
  s.competition.world.top16Locked=false;
  s.story.sceneId="m09-advance-route";s.story.nodeId="advance_entry";
  await assert.rejects(()=>engine.present(s));
});

test("M9_08 advanced gate closes resolution before M9_10 without inventing an R16 opponent",async()=>{
  const {engine}=await makeEngine();
  let s=advancedState();
  const top16=structuredClone(s.competition.world.top16);
  s.story.sceneId="m09-group-resolution";s.story.nodeId="advanced_gate";
  s=await engine.choose(s,"advanced_ready");
  assert.equal(s.story.sceneId,"m09-group-resolution");
  assert.equal(s.story.nodeId,"resolution_complete");
  assert.equal(s.world.flags.m9_advance_route_available,true);
  assert.deepEqual(s.competition.world.top16,top16);
  assert.equal(s.world.flags.world_r16_opponent,undefined);
  assert.equal(s.competition.world.r16Opponent,undefined);
  s=await engine.choose(s,"complete_advance");
  assert.equal(s.story.sceneId,"m09-advance-route");
  assert.equal(s.story.nodeId,"advance_entry");
  assert.deepEqual(s.competition.world.top16,top16);
  assert.equal(s.world.flags.world_r16_opponent,undefined);
  assert.equal(s.competition.world.r16Opponent,undefined);
});

test("M9_10 commit closes M9 and unlocks only M10 on the advanced route",async()=>{
  const {engine}=await makeEngine();
  let s=advancedState();
  const top16=structuredClone(s.competition.world.top16);
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m09-advance-route";s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m10_unlocked,true);
  assert.equal(s.world.flags.m9_complete,true);
  assert.equal(s.world.flags.m9_advance_route_complete,true);
  assert.equal(s.world.flags.m12_unlocked,undefined);
  assert.equal(s.world.flags.world_group_advanced,true);
  assert.deepEqual(s.competition.world.top16,top16);
  assert.deepEqual(s.player.roster,roster);
});

test("M9_10 does not duplicate group results, Top16 or competition history",async()=>{
  const {engine}=await makeEngine();
  let s=advancedState();
  s.competition.history=[
    {matchId:"WORLD_GROUP_MD1",outcome:"win"},
    {matchId:"WORLD_GROUP_MD2",outcome:"win"},
    {matchId:"WORLD_GROUP_MD3",outcome:"win"}
  ];
  const before=structuredClone({
    matches:s.competition.world.groupStage.playerMatches,
    standings:s.competition.world.groupStage.standings,
    top16:s.competition.world.top16,
    history:s.competition.history
  });
  s.story.sceneId="m09-advance-route";s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.deepEqual(s.competition.world.groupStage.playerMatches,before.matches);
  assert.deepEqual(s.competition.world.groupStage.standings,before.standings);
  assert.deepEqual(s.competition.world.top16,before.top16);
  assert.deepEqual(s.competition.history,before.history);
});

test("M9 advanced exit survives save/reload exactly",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m9final-"));
    const {engine}=await makeEngine();
    let s=advancedState();
    s.story.sceneId="m09-advance-route";s.story.nodeId="commit";
    s=await engine.choose(s,"commit_now");
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load("slot-m9-final");
    assert.equal(loaded.world.flags.m9_complete,true);
    assert.equal(loaded.world.flags.m10_unlocked,true);
    assert.equal(loaded.world.flags.m12_unlocked,undefined);
    assert.deepEqual(loaded.competition.world.top16,s.competition.world.top16);
    assert.deepEqual(loaded.competition.world.groupStage,s.competition.world.groupStage);
    assert.deepEqual(loaded.player.roster,s.player.roster);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
