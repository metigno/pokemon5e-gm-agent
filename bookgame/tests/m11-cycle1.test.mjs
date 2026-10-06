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
const fixedNow=()=> "2026-10-06T17:15:00.000Z";

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

function base({rei=true}={}){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot=rei?"slot-m11-rei":"slot-m11-no-rei";
  s.player.trainerLevel=20;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.world.locationId="world_knockout_hall";
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,m7_complete:true,m8_complete:true,m9_complete:true,m10_complete:true,
    m11_unlocked:true,world_qualified:true,world_group_advanced:true,world_eliminated:false,world_qf_won:true,world_qf_resolved:true,
    world_top16_locked:true,world_group_stage_resolved:true,world_top4_locked:true
  });
  const world=s.competition.world;
  world.drawComplete=true;
  world.fieldLocked=true;
  world.drawSeed=rei?"m11-rei-seed":"m11-no-rei-seed";
  world.playerOpponents=[p("group_1","Group One"),p("group_2","Group Two"),p("group_3","Group Three")];
  world.top16Locked=true;
  world.top16=Array.from({length:16},(_,i)=>({participantId:"top16_"+i,name:i===0?"Luke":"Top16 "+i,group:String.fromCharCode(65+Math.floor(i/2)),groupPosition:i%2+1,points:9-(i%2)*3}));
  world.groupStage.opened=true;
  world.groupStage.resolved=true;
  world.groupStage.advanced=true;

  const top4=rei
    ? [p("c2060_01_luke","Luke"),p("c2060_31_rei","Rei"),p("c2060_03_daniel","Daniel"),p("c2060_17_cynthia","Cynthia")]
    : [p("c2060_01_luke","Luke"),p("c2060_03_daniel","Daniel"),p("c2060_17_cynthia","Cynthia"),p("c2060_09_red","Red")];
  world.top4Locked=true;
  world.top4=structuredClone(top4);
  const k=world.knockout;
  k.opened=true;
  k.r16Resolved=true;
  k.top8Locked=true;
  k.playerAdvancedToQf=true;
  k.qfResolved=true;
  k.top4Locked=true;
  k.top4=structuredClone(top4);
  k.playerAdvancedToSf=true;
  k.sfBracket=[
    {round:"SF",matchId:"WORLD_SF_1",home:structuredClone(top4[0]),away:structuredClone(top4[1]),outcome:null,playerOutcome:null,winnerId:null,loserId:null,resolvedAtMinutes:null,source:null},
    {round:"SF",matchId:"WORLD_SF_2",home:structuredClone(top4[2]),away:structuredClone(top4[3]),outcome:null,playerOutcome:null,winnerId:null,loserId:null,resolvedAtMinutes:null,source:null}
  ];
  k.playerSfMatchId="WORLD_SF_1";
  k.playerSfOpponent=structuredClone(top4[1]);
  return s;
}

async function openSf(engine,state=base()){
  let s=structuredClone(state);
  s.story.sceneId="m11-final-four-lock";
  s.story.nodeId="lock_guard";
  return engine.choose(s,"lock_now");
}

async function prepSf(engine,state){
  let s=structuredClone(state);
  s.world.flags.m11_rei_thread_complete=true;
  s.story.sceneId="m11-sf-prep";
  s.story.nodeId="commit";
  return engine.choose(s,"commit_now");
}

async function playSf(engine,state,outcome="win"){
  let s=await prepSf(engine,state);
  s.story.sceneId="m11-world-sf";
  s.story.nodeId="match_handoff";
  s=await engine.choose(s,"fight_sf");
  assert.equal(s.pending.competition.worldKnockoutRound,"SF");
  assert.equal(s.pending.competition.matchId,"WORLD_SF_1");
  assert.equal(s.pending.competition.opponentTrainerId,state.competition.world.knockout.playerSfOpponent.id);
  assert.equal(s.pending.opponent.trainerId,state.competition.world.knockout.playerSfOpponent.id);
  assert.equal(1+s.pending.opponentBench.length,6);
  s=engine.resolveCombatHandoff(s,outcome);
  s=await engine.choose(s,outcome==="win"?"win_record":"loss_record");
  return s;
}

async function resolveSfRound(engine,state,outcome="win"){
  let s=await playSf(engine,state,outcome);
  s.story.sceneId="m11-other-sf";
  s.story.nodeId="resolve_guard";
  s=await engine.choose(s,"resolve_now");
  return s;
}

test("M11_00 consumes the real Top4 and opens WORLD_SF without rebuilding the bracket",async()=>{
  const {engine}=await makeEngine();
  const before=base();
  const bracket=structuredClone(before.competition.world.knockout.sfBracket);
  const s=await openSf(engine,before);
  assert.equal(s.competition.world.knockout.sfOpened,true);
  assert.deepEqual(s.competition.world.knockout.sfBracket,bracket);
  assert.equal(s.competition.world.knockout.playerSfOpponent.name,"Rei");
  assert.equal(s.competition.world.knockout.reiInTop4,true);
  assert.equal(s.competition.world.knockout.reiIsPlayerOpponent,true);
  assert.equal(s.world.flags.m11_final_four_lock_complete,true);
});

test("M11_00 repeated SF open is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=await openSf(engine);
  const bracket=structuredClone(s.competition.world.knockout.sfBracket);
  s.story.sceneId="m11-final-four-lock";
  s.story.nodeId="lock_guard";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="lock_now"),false);
  assert.ok(view.choices.some(c=>c.id==="lock_existing"));
  s=await engine.choose(s,"lock_existing");
  assert.deepEqual(s.competition.world.knockout.sfBracket,bracket);
});

test("M11_01 Rei physical contact exists only when Top4 state and venue schedule agree",async()=>{
  const {engine}=await makeEngine();
  let s=await openSf(engine,base({rei:true}));
  assert.equal(s.npcs.Rei.name,"Rei");
  assert.equal(s.npcs.Rei.schedule.locationId,"world_knockout_hall");
  s.story.sceneId="m11-rei-thread";
  s.story.nodeId="schedule_gate";
  let view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="schedule_meet"));
  const before=s.npcs.Rei.relationship.score;
  s=await engine.choose(s,"schedule_meet");
  assert.equal(s.npcs.Rei.relationship.score,before+1);

  let noRei=await openSf(engine,base({rei:false}));
  noRei.story.sceneId="m11-rei-thread";
  noRei.story.nodeId="schedule_gate";
  view=await engine.present(noRei);
  assert.equal(view.choices.some(c=>c.id==="schedule_meet"),false);
  assert.equal(noRei.competition.world.knockout.reiInTop4,false);
});

test("M11_02 prep advances time without healing or rebuilding the roster",async()=>{
  const {engine}=await makeEngine();
  let s=await openSf(engine);
  s.world.flags.m11_rei_thread_complete=true;
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m11-sf-prep";
  s.story.nodeId="time_budget";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"time_short");
  assert.equal(s.world.elapsedMinutes-before,15);
  assert.deepEqual(s.player.roster,roster);
  s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m11_sf_prep_complete,true);
  assert.deepEqual(s.player.roster,roster);
});

test("M11_03 uses the actual E5 SF opponent and records one official semifinal result",async()=>{
  const {engine}=await makeEngine();
  let s=await openSf(engine);
  s=await playSf(engine,s,"win");
  assert.equal(s.world.flags.world_sf_won,true);
  assert.equal(s.world.flags.world_eliminated,false);
  assert.equal(s.competition.world.knockout.playerAdvancedToFinal,true);
  const match=s.competition.world.knockout.sfBracket.find(m=>m.matchId==="WORLD_SF_1");
  assert.equal(match.playerOutcome,"win");
  assert.equal(match.source,"player_pokemon5e_combat");
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_SF_1").length,1);
  assert.equal(s.world.flags.m11_world_sf_complete,true);
  s.story.sceneId="m11-world-sf";
  s.story.nodeId="match_handoff";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="fight_sf"),false);
});

test("M11_04 resolves the other semifinal once and locks the real two finalists",async()=>{
  const {engine}=await makeEngine();
  const s=await resolveSfRound(engine,await openSf(engine),"win");
  const k=s.competition.world.knockout;
  assert.equal(k.sfResolved,true);
  assert.equal(k.sfResults.length,2);
  assert.equal(k.sfResults.filter(m=>m.source==="player_pokemon5e_combat").length,1);
  assert.equal(k.sfResults.filter(m=>m.source==="deterministic_offscreen_world_resolution").length,1);
  assert.equal(k.finalistsLocked,true);
  assert.equal(k.finalists.length,2);
  assert.equal(new Set(k.finalists.map(x=>x.id)).size,2);
  assert.equal(k.finalists.some(x=>x.name==="Luke"),true);
  assert.equal(k.finalMatch.matchId,"WORLD_FINAL_1");
  assert.equal(k.playerFinalMatchId,"WORLD_FINAL_1");
  assert.ok(k.playerFinalOpponent);
  assert.equal(s.world.flags.world_finalist,true);
});

test("M11 semifinal loss eliminates the player while the actual two winners still form the final",async()=>{
  const {engine}=await makeEngine();
  const s=await resolveSfRound(engine,await openSf(engine),"lose");
  const k=s.competition.world.knockout;
  assert.equal(s.world.flags.world_eliminated,true);
  assert.equal(s.world.flags.world_sf_won,false);
  assert.equal(k.playerAdvancedToFinal,false);
  assert.equal(k.finalists.some(x=>x.name==="Luke"),false);
  assert.equal(k.finalists.length,2);
  assert.equal(k.playerFinalMatchId,null);
  assert.equal(k.playerFinalOpponent,null);
  assert.equal(s.world.flags.world_finalist,false);
});

test("M11 SF resolution is idempotent",async()=>{
  const {engine}=await makeEngine();
  let s=await resolveSfRound(engine,await openSf(engine),"win");
  const finalists=structuredClone(s.competition.world.knockout.finalists);
  const finalMatch=structuredClone(s.competition.world.knockout.finalMatch);
  s.story.sceneId="m11-other-sf";
  s.story.nodeId="resolve_guard";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="resolve_now"),false);
  assert.ok(view.choices.some(c=>c.id==="resolve_existing"));
  s=await engine.choose(s,"resolve_existing");
  assert.deepEqual(s.competition.world.knockout.finalists,finalists);
  assert.deepEqual(s.competition.world.knockout.finalMatch,finalMatch);
});

test("M11 cycle1 save/reload preserves Top4, SF results, finalists, roster and official history",async()=>{
  let dir;
  try{
    const {engine}=await makeEngine();
    let s=await resolveSfRound(engine,await openSf(engine),"win");
    s.story.sceneId="m11-other-sf";
    s.story.nodeId="commit";
    s=await engine.choose(s,"commit_now");
    assert.equal(s.world.flags.m11_cycle1_complete,true);
    dir=await mkdtemp(path.join(os.tmpdir(),"m11c1-"));
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load(s.slot);
    assert.deepEqual(loaded.competition.world,s.competition.world);
    assert.deepEqual(loaded.player.roster,s.player.roster);
    assert.deepEqual(loaded.competition.history,s.competition.history);
    assert.equal(loaded.world.flags.m11_other_sf_complete,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
