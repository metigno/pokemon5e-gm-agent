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
const fixedNow=()=> "2026-10-06T15:50:00.000Z";

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
  s.slot="slot-m10-cycle1";
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
    B:[p("c2060_21_blue","Blue"),p("c2060_27_silas_crowe","Silas Crowe"),p("b3","Boreal B3"),p("b4","Boreal B4")],
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
  world.drawSeed="m10-cycle1-seed";
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

async function playR16(engine,outcome="win"){
  let s=await openBracket(engine);
  s.world.flags.m10_silas_thread_complete=true;
  s.world.flags.m10_r16_prep_complete=true;
  s.story.sceneId="m10-world-r16";
  s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_r16");
  assert.equal(s.pending.competition.matchId,"WORLD_R16_1");
  assert.equal(s.pending.competition.worldKnockoutRound,"R16");
  assert.equal(s.pending.competition.opponentTrainerId,"c2060_27_silas_crowe");
  assert.equal(s.pending.opponent.trainerId,"c2060_27_silas_crowe");
  assert.equal(1+s.pending.opponentBench.length,6);
  s=engine.resolveCombatHandoff(s,outcome);
  s=await engine.choose(s,outcome==="win"?"win_record":"loss_record");
  return s;
}

async function resolveRound(engine,outcome="win"){
  let s=await playR16(engine,outcome);
  s.story.sceneId="m10-r16-aftermath";
  s.story.nodeId="resolve_guard";
  s=await engine.choose(s,"resolve_now");
  return s;
}

test("M10_00 derives the R16 bracket only from the locked Top16",async()=>{
  const {engine}=await makeEngine();
  const before=base();
  const top16=structuredClone(before.competition.world.top16);
  const s=await openBracket(engine,before);
  assert.equal(s.competition.world.knockout.opened,true);
  assert.equal(s.competition.world.knockout.r16Bracket.length,8);
  assert.equal(new Set(s.competition.world.knockout.r16Bracket.flatMap(m=>[m.home.id,m.away.id])).size,16);
  assert.equal(s.competition.world.knockout.playerR16MatchId,"WORLD_R16_1");
  assert.equal(s.competition.world.knockout.playerR16Opponent.name,"Silas Crowe");
  assert.deepEqual(s.competition.world.top16,top16);
  assert.equal(s.world.flags.world_r16_opponent,"Silas Crowe");
});

test("M10_00 repeated bracket open is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=await openBracket(engine);
  const bracket=structuredClone(s.competition.world.knockout.r16Bracket);
  s.story.sceneId="m10-r16-bracket";
  s.story.nodeId="commit_guard";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="commit_open"),false);
  assert.ok(view.choices.some(c=>c.id==="commit_existing"));
  s=await engine.choose(s,"commit_existing");
  assert.deepEqual(s.competition.world.knockout.r16Bracket,bracket);
});

test("M10_01 Silas physical contact exists only from real Top16 venue schedule",async()=>{
  const {engine}=await makeEngine();
  let s=await openBracket(engine);
  assert.equal(s.world.flags.m10_silas_available,true);
  assert.equal(s.npcs.SilasCrowe.name,"Silas Crowe");
  assert.equal(s.npcs.SilasCrowe.schedule.locationId,"world_knockout_hall");
  s.story.sceneId="m10-silas-thread";
  s.story.nodeId="schedule_gate";
  let view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="schedule_meet"));
  s.world.locationId="world_village";
  view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="schedule_meet"),false);
  assert.ok(view.choices.some(c=>c.id==="schedule_public"));
});

test("M10_02 prep advances time without healing or rebuilding the roster",async()=>{
  const {engine}=await makeEngine();
  let s=await openBracket(engine);
  s.world.flags.m10_silas_thread_complete=true;
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m10-r16-prep";
  s.story.nodeId="time_budget";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"time_short");
  assert.equal(s.world.elapsedMinutes-before,15);
  assert.deepEqual(s.player.roster,roster);
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m10_r16_prep_complete,true);
  assert.deepEqual(s.player.roster,roster);
});

test("M10_03 uses the E5 R16 opponent dynamically and records one official result",async()=>{
  const {engine}=await makeEngine();
  let s=await playR16(engine,"win");
  assert.equal(s.world.flags.world_r16_won,true);
  assert.equal(s.world.flags.world_eliminated,false);
  assert.equal(s.competition.world.knockout.playerAdvancedToQf,true);
  const playerMatch=s.competition.world.knockout.r16Bracket.find(m=>m.matchId==="WORLD_R16_1");
  assert.equal(playerMatch.playerOutcome,"win");
  assert.equal(playerMatch.source,"player_pokemon5e_combat");
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_R16_1").length,1);
  assert.equal(s.world.flags.m10_world_r16_complete,true);
  s.story.sceneId="m10-world-r16";
  s.story.nodeId="match_handoff";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="fight_r16"),false);
});

test("M10_04 resolves the other R16 matches once and locks a real Top8/QF pairing",async()=>{
  const {engine}=await makeEngine();
  const s=await resolveRound(engine,"win");
  const k=s.competition.world.knockout;
  assert.equal(k.r16Resolved,true);
  assert.equal(k.r16Results.length,8);
  assert.equal(k.r16Results.filter(m=>m.source==="player_pokemon5e_combat").length,1);
  assert.equal(k.r16Results.filter(m=>m.source==="deterministic_offscreen_world_resolution").length,7);
  assert.equal(s.competition.world.top8Locked,true);
  assert.equal(s.competition.world.top8.length,8);
  assert.equal(new Set(s.competition.world.top8.map(x=>x.id)).size,8);
  assert.equal(s.competition.world.top8.some(x=>x.name==="Luke"),true);
  assert.equal(s.competition.world.top8.some(x=>x.name==="Silas Crowe"),false);
  assert.equal(k.qfBracket.length,4);
  assert.ok(k.playerQfOpponent);
  assert.equal(s.world.flags.world_top8_locked,true);
});

test("M10 R16 loss eliminates the player and advances the actual opponent instead",async()=>{
  const {engine}=await makeEngine();
  const s=await resolveRound(engine,"lose");
  assert.equal(s.world.flags.world_eliminated,true);
  assert.equal(s.world.flags.world_r16_won,false);
  assert.equal(s.competition.world.knockout.playerQfOpponent,null);
  assert.equal(s.competition.world.top8.some(x=>x.name==="Luke"),false);
  assert.equal(s.competition.world.top8.some(x=>x.name==="Silas Crowe"),true);
});

test("M10 cycle1 save/reload preserves bracket, Top8, roster and official history",async()=>{
  let dir;
  try{
    const {engine}=await makeEngine();
    let s=await resolveRound(engine,"win");
    s.story.sceneId="m10-r16-aftermath";
    s.story.nodeId="commit";
    s=await engine.choose(s,"commit_now");
    assert.equal(s.world.flags.m10_cycle1_complete,true);
    dir=await mkdtemp(path.join(os.tmpdir(),"m10c1-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load("slot-m10-cycle1");
    assert.deepEqual(loaded.competition.world,s.competition.world);
    assert.deepEqual(loaded.player.roster,s.player.roster);
    assert.deepEqual(loaded.competition.history,s.competition.history);
    assert.equal(loaded.world.flags.m10_r16_aftermath_complete,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
