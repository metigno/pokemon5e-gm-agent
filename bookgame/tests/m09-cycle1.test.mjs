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
const fixedNow=()=> "2026-10-06T14:10:00.000Z";

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
    id:"player_"+index,
    speciesId,
    name:speciesId,
    level:20,
    hp:{current:20-index,max:20},
    statuses:{nonVolatile:null,remainingRounds:null,flinchedTurns:0},
    abilityId:null,
    moveIds:[],
    pp:{}
  }));
}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot="slot-m9";
  s.player.trainerLevel=18;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.competition.rank="S";
  s.competition.rankOrder=6;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,
    m7_complete:true,m8_complete:true,m09_unlocked:true,world_qualified:true,
    world_draw_complete:true,world_field_32_locked:true,player_group:"A",
    friend_beat_08_complete:true
  });
  s.world.locationId="world_village";
  const player={id:"c2060_01_luke",name:"Luke"};
  const red={id:"c2060_09_red",name:"Red"};
  const kaia={id:"c2060_32_kaia_solari",name:"Kaia Solari"};
  const fab={id:"c2060_05_fab",name:"Fab"};
  s.competition.world.drawComplete=true;
  s.competition.world.fieldLocked=true;
  s.competition.world.playerGroup="A";
  s.competition.world.groups={A:[player,red,kaia,fab]};
  s.competition.world.playerOpponents=[red,kaia,fab];
  s.competition.world.field=[player,red,kaia,fab];
  s.competition.world.seedOrder=[player,red,kaia,fab];
  s.competition.world.qualifications={
    c2060_01_luke:{participantId:"c2060_01_luke",name:"Luke",qualified:true,source:"player_actual"},
    c2060_09_red:{participantId:"c2060_09_red",name:"Red",qualified:true,source:"npc_actual"},
    c2060_32_kaia_solari:{participantId:"c2060_32_kaia_solari",name:"Kaia Solari",qualified:true,source:"macro_anchor_guarantee"},
    c2060_05_fab:{participantId:"c2060_05_fab",name:"Fab",qualified:true,source:"npc_actual"}
  };
  s.competition.world.drawSeed="m9-test-draw";
  return s;
}

async function openGroups(engine,state=base()){
  let s=state;
  s.story.sceneId="m09-groups-open";
  s.story.nodeId="open_commit";
  s=await engine.choose(s,"open_now");
  return s;
}

async function resolveMd1(engine,outcome="win"){
  let s=await openGroups(engine);
  s.story.sceneId="m09-matchday-one";
  s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_matchday_one");
  assert.equal(s.pending.competition.opponentTrainerId,"c2060_09_red");
  assert.equal(s.pending.opponent.trainerId,"c2060_09_red");
  assert.equal(1+s.pending.opponentBench.length,6);
  s=engine.resolveCombatHandoff(s,outcome);
  assert.equal(s.world.flags.world_group_md1_resolved,true);
  s=await engine.choose(s,outcome==="win"?"win_record":"loss_record");
  return s;
}

test("M9_00 opens WORLD_GROUPS from the immutable M8 draw",async()=>{
  const {engine}=await makeEngine();
  const before=base();
  const opponents=structuredClone(before.competition.world.playerOpponents);
  const s=await openGroups(engine,before);
  assert.equal(s.world.flags.m9_active,true);
  assert.equal(s.world.flags.m9_groups_open_complete,true);
  assert.equal(s.competition.world.groupStage.opened,true);
  assert.equal(s.competition.world.groupStage.playerMatches.length,3);
  assert.deepEqual(s.competition.world.playerOpponents,opponents);
  assert.equal(s.competition.world.groupStage.playerMatches[0].opponentId,"c2060_09_red");
  assert.equal(s.competition.world.groupStage.playerMatches[1].opponentId,"c2060_32_kaia_solari");
  assert.equal(s.competition.world.groupStage.playerMatches[2].opponentId,"c2060_05_fab");
  assert.equal(s.competition.world.groupStage.standings.length,4);
  assert.equal(s.competition.world.groupStage.playerPoints,0);
});

test("M9_00 repeated open is idempotent and does not reroll the group",async()=>{
  const {engine}=await makeEngine();
  let s=await openGroups(engine);
  const snapshot=structuredClone(s.competition.world);
  s.story.sceneId="m09-groups-open";s.story.nodeId="open_commit";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="open_now"),false);
  assert.ok(view.choices.some(c=>c.id==="open_existing"));
  s=await engine.choose(s,"open_existing");
  assert.deepEqual(s.competition.world.playerOpponents,snapshot.playerOpponents);
  assert.deepEqual(s.competition.world.groupStage.playerMatches,snapshot.groupStage.playerMatches);
});

test("M9_01 resolves opponent index 0 dynamically and records both group matches",async()=>{
  const {engine}=await makeEngine();
  let s=await openGroups(engine);
  s.story.sceneId="m09-matchday-one";s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_matchday_one");
  assert.equal(s.pending.encounterId,"WORLD_GROUP_MD1");
  assert.equal(s.pending.competition.worldOpponentIndex,0);
  assert.equal(s.pending.competition.opponentTrainerId,"c2060_09_red");
  assert.equal(s.pending.opponent.trainerId,"c2060_09_red");
  assert.equal(s.pending.opponent.level,20);
  assert.equal(1+s.pending.opponentBench.length,6);
  s=engine.resolveCombatHandoff(s,"win");
  assert.equal(s.competition.world.groupStage.playerMatches[0].outcome,"win");
  assert.equal(s.competition.world.groupStage.offscreenMatches.length,1);
  assert.equal(s.competition.world.groupStage.playerPoints,3);
  assert.equal(s.competition.history.at(-1).matchId,"WORLD_GROUP_MD1");
  assert.equal(s.world.flags.world_group_md1_result,"win");
});

test("M9_01 resolved Matchday cannot be started twice",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveMd1(engine,"win");
  s.story.sceneId="m09-matchday-one";s.story.nodeId="match_handoff";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="fight_matchday_one"),false);
  assert.equal(s.competition.world.groupStage.playerMatches.filter(m=>m.outcome).length,1);
  assert.equal(s.competition.world.groupStage.offscreenMatches.length,1);
});

test("M9_01 completion triggers Kaia's living-world schedule without changing the draw",async()=>{
  const {engine}=await makeEngine();
  const s=await resolveMd1(engine,"lose");
  assert.equal(s.world.flags.m9_matchday_one_complete,true);
  assert.equal(s.world.flags.m9_kaia_available,true);
  assert.equal(s.npcs.KaiaSolari.name,"Kaia Solari");
  assert.equal(s.npcs.KaiaSolari.schedule.locationId,"world_village");
  assert.equal(s.npcs.KaiaSolari.schedule.present,true);
  assert.equal(s.competition.world.playerOpponents[1].name,"Kaia Solari");
  assert.equal(s.competition.world.groupStage.playerMatches[0].outcome,"lose");
});

test("M9_02 advances real time but never heals or rebuilds the roster",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveMd1(engine,"win");
  const rosterBefore=structuredClone(s.player.roster);
  const before=s.world.elapsedMinutes;
  s.story.sceneId="m09-interday-one";s.story.nodeId="interday_entry";
  s=await engine.choose(s,"entry_village");
  assert.equal(s.world.elapsedMinutes-before,15);
  assert.deepEqual(s.player.roster,rosterBefore);
  s.story.nodeId="wait_window";
  const beforeWait=s.world.elapsedMinutes;
  s=await engine.choose(s,"wait_hour");
  assert.equal(s.world.elapsedMinutes-beforeWait,60);
  assert.deepEqual(s.player.roster,rosterBefore);
  s.story.nodeId="interday_commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m9_interday_one_complete,true);
  assert.deepEqual(s.player.roster,rosterBefore);
});

test("M9_03 allows physical Kaia contact only when player and schedule overlap",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveMd1(engine,"win");
  s.world.flags.m9_interday_one_complete=true;
  s.world.locationId="world_group_arena";
  s.story.sceneId="m09-kaia-thread";s.story.nodeId="kaia_entry";
  let view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="entry_meet"),false);
  assert.ok(view.choices.some(c=>c.id==="entry_public"));
  s.world.locationId="world_village";
  view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="entry_meet"));
  s=await engine.choose(s,"entry_meet");
  assert.equal(s.world.flags.kaia_met,true);
  assert.equal(s.npcs.KaiaSolari.state.introduced,true);
  assert.equal(s.competition.world.groupStage.playerMatches[1].opponentId,"c2060_32_kaia_solari");
});

test("M9_03 public thread can complete without fabricating a personal meeting",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveMd1(engine,"win");
  s.world.flags.m9_interday_one_complete=true;
  s.world.locationId="world_group_arena";
  s.story.sceneId="m09-kaia-thread";s.story.nodeId="thread_commit";
  s=await engine.choose(s,"thread_now");
  assert.equal(s.world.flags.m9_kaia_thread_complete,true);
  assert.equal(s.world.flags.kaia_met,undefined);
  assert.equal(s.competition.world.groupStage.playerMatches[1].outcome,null);
});

test("M9_04 consumes opponent index 1 and preserves Matchday 1 history",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveMd1(engine,"win");
  s.world.flags.m9_interday_one_complete=true;
  s.world.flags.m9_kaia_thread_complete=true;
  s.story.sceneId="m09-matchday-two";s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_matchday_two");
  assert.equal(s.pending.competition.worldOpponentIndex,1);
  assert.equal(s.pending.competition.opponentTrainerId,"c2060_32_kaia_solari");
  assert.equal(s.pending.opponent.trainerId,"c2060_32_kaia_solari");
  s=engine.resolveCombatHandoff(s,"lose");
  assert.equal(s.competition.world.groupStage.playerMatches[0].outcome,"win");
  assert.equal(s.competition.world.groupStage.playerMatches[1].outcome,"lose");
  assert.equal(s.competition.world.groupStage.playerMatches[2].outcome,null);
  assert.equal(s.competition.world.groupStage.offscreenMatches.length,2);
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_GROUP_MD1").length,1);
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_GROUP_MD2").length,1);
  s=await engine.choose(s,"loss_record");
  assert.equal(s.world.flags.m9_matchday_two_complete,true);
});

test("M9 cycle1 save/reload preserves draw, standings, schedules and two-day progress",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m9c1-"));
    const {engine}=await makeEngine();
    let s=await resolveMd1(engine,"win");
    s.world.flags.m9_interday_one_complete=true;
    s.world.flags.m9_kaia_thread_complete=true;
    s.story.sceneId="m09-matchday-two";s.story.nodeId="match_handoff";
    s=await engine.choose(s,"fight_matchday_two");
    s=engine.resolveCombatHandoff(s,"win");
    s=await engine.choose(s,"win_record");
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load("slot-m9");
    assert.deepEqual(loaded.competition.world,s.competition.world);
    assert.deepEqual(loaded.npcs.KaiaSolari,s.npcs.KaiaSolari);
    assert.equal(loaded.world.flags.world_group_md1_result,"win");
    assert.equal(loaded.world.flags.world_group_md2_result,"win");
    assert.equal(loaded.competition.world.groupStage.offscreenMatches.length,2);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
