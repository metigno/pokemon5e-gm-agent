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
const fixedNow=()=> "2026-10-06T16:20:00.000Z";

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
function p(id,name){return {id,name};}

function base(){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot="slot-m10-cycle2";
  s.player.trainerLevel=20;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.world.locationId="world_knockout_hall";
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,m7_complete:true,m8_complete:true,m9_complete:true,
    m10_unlocked:true,world_qualified:true,world_group_advanced:true,world_eliminated:false,world_top16_locked:true,world_group_stage_resolved:true
  });

  const groups={
    A:[p("c2060_01_luke","Luke"),p("c2060_09_red","Red"),p("a3","Aster A3"),p("a4","Aster A4")],
    B:[p("c2060_03_daniel","Daniel"),p("c2060_27_silas_crowe","Silas Crowe"),p("b3","Boreal B3"),p("b4","Boreal B4")],
    C:[p("c1","Cinder C1"),p("c2","Cinder C2"),p("c3","Cinder C3"),p("c4","Cinder C4")],
    D:[p("d1","Dawn D1"),p("d2","Dawn D2"),p("d3","Dawn D3"),p("d4","Dawn D4")],
    E:[p("e1","Ember E1"),p("e2","Ember E2"),p("e3","Ember E3"),p("e4","Ember E4")],
    F:[p("f1","Frost F1"),p("f2","Frost F2"),p("f3","Frost F3"),p("f4","Frost F4")],
    G:[p("g1","Gale G1"),p("g2","Gale G2"),p("g3","Gale G3"),p("g4","Gale G4")],
    H:[p("h1","Harbor H1"),p("h2","Harbor H2"),p("h3","Harbor H3"),p("h4","Harbor H4")]
  };
  const world=s.competition.world;
  world.drawComplete=true;
  world.fieldLocked=true;
  world.groups=structuredClone(groups);
  world.field=Object.values(groups).flat();
  world.seedOrder=structuredClone(world.field);
  world.playerGroup="A";
  world.playerOpponents=structuredClone(groups.A.slice(1));
  world.drawSeed="m10-cycle2-seed";
  world.qualifications.c2060_03_daniel={participantId:"c2060_03_daniel",name:"Daniel",qualified:true,source:"npc_actual"};
  world.top16Locked=true;
  world.top16=Object.entries(groups).flatMap(([group,participants])=>participants.slice(0,2).map((entry,index)=>({
    participantId:entry.id,name:entry.name,group,groupPosition:index+1,points:index===0?9:6
  })));
  world.groupStage.opened=true;
  world.groupStage.playerGroup="A";
  world.groupStage.participants=structuredClone(groups.A);
  world.groupStage.finalPosition=1;
  world.groupStage.playerPosition=1;
  world.groupStage.playerPoints=9;
  world.groupStage.advanced=true;
  world.groupStage.resolved=true;
  return s;
}

async function openBracket(engine,state=base()){
  let s=structuredClone(state);
  s.story.sceneId="m10-r16-bracket";
  s.story.nodeId="commit_guard";
  return engine.choose(s,"commit_open");
}

async function resolveR16(engine,outcome="win",state=base()){
  let s=await openBracket(engine,state);
  s.world.flags.m10_silas_thread_complete=true;
  s.world.flags.m10_r16_prep_complete=true;
  s.story.sceneId="m10-world-r16";
  s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_r16");
  s=engine.resolveCombatHandoff(s,outcome);
  s=await engine.choose(s,outcome==="win"?"win_record":"loss_record");
  s.story.sceneId="m10-r16-aftermath";
  s.story.nodeId="resolve_guard";
  s=await engine.choose(s,"resolve_now");
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  return s;
}

async function completeFriendBeat(engine,state,{physical=false}={}){
  let s=structuredClone(state);
  if(physical){
    s.npcs.Daniel.schedule={
      id:"m10_friend_test",locationId:"world_knockout_hall",availability:"available",
      activity:"qf_preparation",startsAtMinutes:null,endsAtMinutes:null,present:false
    };
  }
  s.story.sceneId="m10-friend-beat-10";
  s.story.nodeId="selector";
  s=await engine.choose(s,"select_now");
  assert.equal(s.world.flags.friend_beat_10_friend_id,"Daniel");
  assert.equal(s.world.flags.friend_beat_10_context,"qf_opponent");
  if(physical){
    assert.equal(s.world.flags.friend_beat_10_contact_mode,"physical");
    s.story.nodeId="schedule_gate";
    s=await engine.choose(s,"schedule_physical");
    s=await engine.choose(s,"physical_daniel");
  }else{
    assert.equal(s.world.flags.friend_beat_10_contact_mode,"remote");
    s.story.nodeId="remote_contact";
    s=await engine.choose(s,"remote_accept");
  }
  s.story.nodeId="commitment";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m10_friend_beat_10_complete,true);
  assert.equal(s.world.flags.friend_beat_10_complete,true);
  return s;
}

async function playQf(engine,state,outcome="win"){
  let s=structuredClone(state);
  s.story.sceneId="m10-qf-prep";
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  s.story.sceneId="m10-world-qf";
  s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_qf");
  assert.equal(s.pending.competition.worldKnockoutRound,"QF");
  assert.equal(s.pending.competition.matchId,"WORLD_QF_1");
  assert.equal(s.pending.competition.opponentTrainerId,"c2060_03_daniel");
  assert.equal(s.pending.opponent.trainerId,"c2060_03_daniel");
  assert.equal(1+s.pending.opponentBench.length,6);
  s=engine.resolveCombatHandoff(s,outcome);
  s=await engine.choose(s,outcome==="win"?"win_record":"loss_record");
  return s;
}

async function resolveQfRound(engine,state,outcome="win"){
  let s=await playQf(engine,state,outcome);
  s.story.sceneId="m10-qf-aftermath";
  s.story.nodeId="resolve_guard";
  s=await engine.choose(s,"resolve_now");
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  return s;
}

test("M10_05 knockout Friend Beat selects a real QF opponent and does not alter the bracket",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"win");
  assert.equal(s.competition.world.knockout.playerQfOpponent.name,"Daniel");
  const bracket=structuredClone(s.competition.world.knockout.qfBracket);
  s=await completeFriendBeat(engine,s);
  assert.equal(s.world.flags.friend_beat_10_type,"remote_knockout_contact");
  assert.deepEqual(s.competition.world.knockout.qfBracket,bracket);
  assert.equal(s.world.flags.world_r16_won,true);
});

test("M10_05 physical Friend Beat requires actual schedule overlap and updates only relationship state",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"win");
  const before=s.npcs.Daniel.relationship.score;
  const bracket=structuredClone(s.competition.world.knockout.qfBracket);
  s=await completeFriendBeat(engine,s,{physical:true});
  assert.equal(s.npcs.Daniel.relationship.score,before+1);
  assert.equal(s.world.flags.friend_beat_10_type,"physical_knockout_contact");
  assert.deepEqual(s.competition.world.knockout.qfBracket,bracket);
});

test("M10_05 routes an R16 loss toward module outcome instead of inventing a QF",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"lose");
  s=await completeFriendBeat(engine,s);
  s.story.sceneId="m10-friend-beat-10";
  s.story.nodeId="branch_gate";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="branch_qf"),false);
  assert.ok(view.choices.some(c=>c.id==="branch_exit"));
  assert.equal(s.competition.world.knockout.playerQfMatchId,null);
});

test("M10_06 QF prep advances time without healing or rebuilding the roster",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"win");
  s=await completeFriendBeat(engine,s);
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m10-qf-prep";
  s.story.nodeId="time_budget";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"time_short");
  assert.equal(s.world.elapsedMinutes-before,15);
  assert.deepEqual(s.player.roster,roster);
});

test("M10_07 uses the actual E5 QF opponent and records one official QF result",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"win");
  s=await completeFriendBeat(engine,s);
  s=await playQf(engine,s,"win");
  assert.equal(s.world.flags.world_qf_won,true);
  assert.equal(s.world.flags.world_eliminated,false);
  assert.equal(s.competition.world.knockout.playerAdvancedToSf,true);
  const match=s.competition.world.knockout.qfBracket.find(m=>m.matchId==="WORLD_QF_1");
  assert.equal(match.playerOutcome,"win");
  assert.equal(match.source,"player_pokemon5e_combat");
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_QF_1").length,1);
  s.story.sceneId="m10-world-qf";
  s.story.nodeId="match_handoff";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="fight_qf"),false);
});

test("M10_08 resolves the other QFs once and locks a real Top4/SF bracket",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"win");
  s=await completeFriendBeat(engine,s);
  s=await resolveQfRound(engine,s,"win");
  const k=s.competition.world.knockout;
  assert.equal(k.qfResolved,true);
  assert.equal(k.qfResults.length,4);
  assert.equal(k.qfResults.filter(m=>m.source==="player_pokemon5e_combat").length,1);
  assert.equal(k.qfResults.filter(m=>m.source==="deterministic_offscreen_world_resolution").length,3);
  assert.equal(s.competition.world.top4Locked,true);
  assert.equal(s.competition.world.top4.length,4);
  assert.equal(new Set(s.competition.world.top4.map(x=>x.id)).size,4);
  assert.equal(s.competition.world.top4.some(x=>x.name==="Luke"),true);
  assert.equal(s.competition.world.top4.some(x=>x.name==="Daniel"),false);
  assert.equal(k.sfBracket.length,2);
  assert.ok(k.playerSfOpponent);
  assert.equal(s.world.flags.world_top4_locked,true);
});

test("M10 QF loss eliminates the player and advances Daniel instead",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"win");
  s=await completeFriendBeat(engine,s);
  s=await resolveQfRound(engine,s,"lose");
  assert.equal(s.world.flags.world_eliminated,true);
  assert.equal(s.world.flags.world_qf_won,false);
  assert.equal(s.competition.world.knockout.playerSfOpponent,null);
  assert.equal(s.competition.world.top4.some(x=>x.name==="Luke"),false);
  assert.equal(s.competition.world.top4.some(x=>x.name==="Daniel"),true);
});

test("M10_09 R16 elimination unlocks M12 and never M11",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveR16(engine,"lose");
  s=await completeFriendBeat(engine,s);
  s.story.sceneId="m10-module-outcome";
  s.story.nodeId="commit_guard";
  s=await engine.choose(s,"commit_m12");
  assert.equal(s.world.flags.m10_complete,true);
  assert.equal(s.world.flags.m12_unlocked,true);
  assert.equal(s.world.flags.m11_unlocked,undefined);
  assert.equal(s.world.flags.m10_outcome_route,"world_exit");
});

test("M10_09 QF loss unlocks M12 while QF win unlocks M11 from the real Top4",async()=>{
  const {engine}=await makeEngine();

  let loss=await resolveR16(engine,"win");
  loss=await completeFriendBeat(engine,loss);
  loss=await resolveQfRound(engine,loss,"lose");
  loss.story.sceneId="m10-module-outcome";
  loss.story.nodeId="commit_guard";
  loss=await engine.choose(loss,"commit_m12");
  assert.equal(loss.world.flags.m12_unlocked,true);
  assert.equal(loss.world.flags.m11_unlocked,undefined);

  let win=await resolveR16(engine,"win");
  win=await completeFriendBeat(engine,win);
  win=await resolveQfRound(engine,win,"win");
  win.story.sceneId="m10-module-outcome";
  win.story.nodeId="commit_guard";
  win=await engine.choose(win,"commit_m11");
  assert.equal(win.world.flags.m10_complete,true);
  assert.equal(win.world.flags.m11_unlocked,true);
  assert.equal(win.world.flags.m12_unlocked,undefined);
  assert.equal(win.world.flags.m10_outcome_route,"final_four");
  assert.equal(win.competition.world.top4.some(x=>x.name==="Luke"),true);
  assert.ok(win.competition.world.knockout.playerSfMatchId);
});

test("M10 final save/reload preserves Top4, Friend Beat, roster and official history",async()=>{
  let dir;
  try{
    const {engine}=await makeEngine();
    let s=await resolveR16(engine,"win");
    s=await completeFriendBeat(engine,s);
    s=await resolveQfRound(engine,s,"win");
    s.story.sceneId="m10-module-outcome";
    s.story.nodeId="commit_guard";
    s=await engine.choose(s,"commit_m11");
    dir=await mkdtemp(path.join(os.tmpdir(),"m10final-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load("slot-m10-cycle2");
    assert.deepEqual(loaded.competition.world,s.competition.world);
    assert.deepEqual(loaded.player.roster,s.player.roster);
    assert.deepEqual(loaded.competition.history,s.competition.history);
    assert.equal(loaded.world.flags.friend_beat_10_friend_id,"Daniel");
    assert.equal(loaded.world.flags.m10_complete,true);
    assert.equal(loaded.world.flags.m11_unlocked,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
