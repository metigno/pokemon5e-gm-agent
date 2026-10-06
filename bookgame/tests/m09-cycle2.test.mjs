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
import { applyWorldFriendBeatSelection } from "../src/engine/npc-state.mjs";

const scenesDir=fileURLToPath(new URL("../content/scenes/",import.meta.url));
const modulesDir=fileURLToPath(new URL("../content/modules/",import.meta.url));
const eventsDir=fileURLToPath(new URL("../content/events/",import.meta.url));
const ecologyProfilesDir=fileURLToPath(new URL("../content/ecology/",import.meta.url));
const zonePoolsFile=fileURLToPath(new URL("../../campaign/world/ecology/ZONE_POOLS.json",import.meta.url));
const distributionFile=fileURLToPath(new URL("../../campaign/world/ecology/SPECIES_DISTRIBUTION.json",import.meta.url));
const faunaIndexFile=fileURLToPath(new URL("../../campaign/world/fauna/ASTERIA_FAUNA_INDEX.json",import.meta.url));
const ecologyOptions={profilesDir:ecologyProfilesDir,zonePoolsFile,distributionFile,faunaIndexFile};
const fixedNow=()=> "2026-10-06T14:45:00.000Z";

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

function fullWorld(s,{sameGroupFriend=true}={}){
  const Luke=participant("c2060_01_luke","Luke");
  const Red=participant("c2060_09_red","Red");
  const Kaia=participant("c2060_32_kaia_solari","Kaia Solari");
  const Fab=participant("c2060_05_fab","Fab");
  const Cynthia=participant("c2060_06_cynthia","Cynthia");
  const Mattew=participant("c2060_02_mattew","Mattew");
  const Daniel=participant("c2060_03_daniel","Daniel");
  const Edward=participant("c2060_04_edward","Edward");

  const groups={
    A:sameGroupFriend?[Luke,Red,Kaia,Fab]:[Luke,Red,Kaia,Cynthia],
    B:sameGroupFriend?[Mattew,Daniel,Edward,Cynthia]:[Mattew,Daniel,Edward,Fab],
    C:[participant("c2060_07_steven","Steven Stone"),participant("c2060_08_n","N"),participant("c2060_10_lance","Lance"),participant("c2060_21_blue","Blue")],
    D:[participant("c2060_22_giovanni","Giovanni"),participant("c2060_20_rei","Rei"),participant("c2060_26_astrid","Astrid Vahl"),participant("c2060_27_silas","Silas Crowe")],
    E:[participant("c2060_13_kael","Kael"),participant("c2060_14_darian","Darian"),participant("c2060_15_ferred","Ferred"),participant("c2060_16_ren","Ren")],
    F:[participant("c2060_17_ethan","Ethan"),participant("c2060_18_brendan","Brendan"),participant("c2060_19_lucinda","Lucinda"),participant("c2060_12_alder","Alder")],
    G:[participant("c2060_24_archie","Archie"),participant("c2060_25_maxie","Maxie"),participant("c2060_28_rurik","Rurik Dune"),participant("c2060_29_ayame","Ayame Hoshino")],
    H:[participant("c2060_30_orion","Orion Vale"),participant("c2060_31_nyx","Nyx Vesper"),participant("c2060_33_lucas","Lucas"),participant("c2060_34_ronan","Ronan Ward")]
  };
  const field=Object.values(groups).flat();
  s.competition.world.drawComplete=true;
  s.competition.world.fieldLocked=true;
  s.competition.world.groups=structuredClone(groups);
  s.competition.world.playerGroup="A";
  s.competition.world.playerOpponents=structuredClone(groups.A.slice(1));
  s.competition.world.field=structuredClone(field);
  s.competition.world.seedOrder=structuredClone(field);
  s.competition.world.qualifications=Object.fromEntries(field.map(p=>[p.id,{participantId:p.id,name:p.name,qualified:true,source:"test_actual"}]));
  s.competition.world.drawSeed="m9-cycle2-seed";
  return s;
}

function base(opts={}){
  const s=createNewGameState({protagonist:"Luke",now:fixedNow});
  s.slot="slot-m9-cycle2";
  s.player.trainerLevel=18;
  s.player.roster=sixRoster();
  s.player.starter=structuredClone(s.player.roster[0]);
  s.competition.rank="S";s.competition.rankOrder=6;
  Object.assign(s.world.flags,{
    m1_complete:true,m2_complete:true,m3_complete:true,m4_complete:true,m5_complete:true,m6_complete:true,m7_complete:true,m8_complete:true,
    m09_unlocked:true,world_qualified:true,world_draw_complete:true,world_field_32_locked:true,player_group:"A",
    friend_beat_08_complete:true,friend_beat_08_friend_id:"Mattew"
  });
  s.world.locationId="world_village";
  return fullWorld(s,opts);
}

async function openGroups(engine,s=base()){
  s.story.sceneId="m09-groups-open";s.story.nodeId="open_commit";
  return engine.choose(s,"open_now");
}

async function playMatch(engine,s,index,outcome){
  const sceneId=["m09-matchday-one","m09-matchday-two","m09-matchday-three"][index];
  const choiceId=["fight_matchday_one","fight_matchday_two","fight_matchday_three"][index];
  s.story.sceneId=sceneId;s.story.nodeId="match_handoff";
  s=await engine.choose(s,choiceId);
  assert.equal(s.pending.competition.worldOpponentIndex,index);
  assert.equal(s.pending.competition.opponentTrainerId,s.competition.world.playerOpponents[index].id);
  s=engine.resolveCombatHandoff(s,outcome);
  const recordChoice=outcome==="win"?"win_record":"loss_record";
  s=await engine.choose(s,recordChoice);
  return s;
}

async function throughMd2(engine,outcomes=["win","lose"],opts={}){
  let s=await openGroups(engine,base(opts));
  s=await playMatch(engine,s,0,outcomes[0]);
  s.world.flags.m9_interday_one_complete=true;
  s.world.flags.m9_kaia_thread_complete=true;
  s=await playMatch(engine,s,1,outcomes[1]);
  return s;
}

async function throughMd3(engine,outcomes=["win","lose","win"],opts={}){
  let s=await throughMd2(engine,outcomes.slice(0,2),opts);
  s.world.flags.friend_beat_09_complete=true;
  s.world.flags.m9_interday_two_complete=true;
  s=await playMatch(engine,s,2,outcomes[2]);
  return s;
}

test("M9_05 selector prioritizes a real same-group upcoming friend match",async()=>{
  const {engine}=await makeEngine();
  const s=await throughMd2(engine,["win","lose"],{sameGroupFriend:true});
  assert.equal(s.world.flags.friend_beat_09_available,true);
  assert.equal(s.world.flags.friend_beat_09_friend_id,"Fab");
  assert.equal(s.world.flags.friend_beat_09_context,"same_group_next_match");
  assert.equal(s.world.flags.friend_beat_09_opponent_index,2);
  assert.equal(s.competition.world.playerOpponents[2].name,"Fab");
});

test("M9_05 selector uses a qualified friend in another group and avoids the previous Friend Beat when equivalent",()=>{
  const s=base({sameGroupFriend:false});
  s.world.flags.friend_beat_08_friend_id="Mattew";
  const selected=applyWorldFriendBeatSelection(s,{previousFriendFlag:"friend_beat_08_friend_id"});
  assert.equal(selected.context,"qualified_other_group");
  assert.equal(selected.id,"Daniel");
  assert.equal(s.world.flags.friend_beat_09_friend_id,"Daniel");
});

test("M9_05 same-group Friend Beat never creates an extra official combat",async()=>{
  const {engine}=await makeEngine();
  let s=await throughMd2(engine,["win","lose"],{sameGroupFriend:true});
  s.story.sceneId="m09-friend-beat-09";s.story.nodeId="context_dispatch";
  s=await engine.choose(s,"context_next");
  const view=await engine.present(s);
  assert.equal(view.nodeId,"same_group_next");
  assert.equal(view.choices.some(c=>c.combat),false);
  assert.equal(s.competition.history.filter(r=>r.matchId==="WORLD_GROUP_MD3").length,0);
});

test("M9_06 scenario branch reads actual two-match points and does not heal",async()=>{
  const {engine}=await makeEngine();
  let s=await throughMd2(engine,["win","lose"]);
  s.world.flags.friend_beat_09_complete=true;
  const roster=structuredClone(s.player.roster);
  s.story.sceneId="m09-interday-two";s.story.nodeId="standings";
  const view=await engine.present(s);
  assert.equal(s.competition.world.groupStage.playerPoints,3);
  assert.ok(view.choices.some(c=>c.id==="standings_three"));
  assert.equal(view.choices.some(c=>c.id==="standings_six"),false);
  s.story.nodeId="time_window";
  const before=s.world.elapsedMinutes;
  s=await engine.choose(s,"time_hour");
  assert.equal(s.world.elapsedMinutes-before,60);
  assert.deepEqual(s.player.roster,roster);
});

test("M9_07 consumes opponent index 2 exactly once and completes the player group",async()=>{
  const {engine}=await makeEngine();
  let s=await throughMd2(engine,["win","lose"]);
  s.world.flags.friend_beat_09_complete=true;
  s.world.flags.m9_interday_two_complete=true;
  s=await playMatch(engine,s,2,"win");
  assert.equal(s.world.flags.world_group_md3_resolved,true);
  assert.equal(s.competition.world.groupStage.playerMatches[2].outcome,"win");
  assert.equal(s.competition.world.groupStage.offscreenMatches.length,3);
  s.story.sceneId="m09-matchday-three";s.story.nodeId="match_handoff";
  const view=await engine.present(s);
  assert.equal(view.choices.some(c=>c.id==="fight_matchday_three"),false);
});

test("M9_08 resolves all eight groups, applies structured tiebreaks and locks exactly 16",async()=>{
  const {engine}=await makeEngine();
  let s=await throughMd3(engine,["win","win","win"]);
  s.story.sceneId="m09-group-resolution";s.story.nodeId="resolve_commit";
  s=await engine.choose(s,"resolve_now");
  assert.equal(s.competition.world.groupStage.resolved,true);
  assert.equal(Object.keys(s.competition.world.groupStage.allGroupStandings).length,8);
  assert.equal(Object.keys(s.competition.world.groupStage.allGroupMatches).length,8);
  for(const label of Object.keys(s.competition.world.groups)){
    assert.equal(s.competition.world.groupStage.allGroupMatches[label].length,6);
    assert.equal(s.competition.world.groupStage.allGroupStandings[label].length,4);
    assert.equal(s.competition.world.top16.filter(x=>x.group===label).length,2);
  }
  assert.equal(s.competition.world.top16.length,16);
  assert.equal(s.competition.world.top16Locked,true);
  assert.equal(s.world.flags.world_top16_locked,true);
  assert.equal(s.competition.world.groupStage.finalPosition,1);
  assert.equal(s.competition.world.groupStage.advanced,true);
  assert.equal(s.world.flags.world_eliminated,false);
});

test("M9_08 losing all three produces a real eliminated route instead of a narrative retry",async()=>{
  const {engine}=await makeEngine();
  let s=await throughMd3(engine,["lose","lose","lose"]);
  s.story.sceneId="m09-group-resolution";s.story.nodeId="resolve_commit";
  s=await engine.choose(s,"resolve_now");
  assert.equal(s.competition.world.groupStage.finalPosition,4);
  assert.equal(s.competition.world.groupStage.advanced,false);
  assert.equal(s.world.flags.world_eliminated,true);
  s.story.nodeId="route";
  const view=await engine.present(s);
  assert.ok(view.choices.some(c=>c.id==="route_eliminated"));
  assert.equal(view.choices.some(c=>c.id==="route_advanced"),false);
});

test("M9_09 eliminated route unlocks M12 and never M10",async()=>{
  const {engine}=await makeEngine();
  let s=await throughMd3(engine,["lose","lose","lose"]);
  s.story.sceneId="m09-group-resolution";s.story.nodeId="resolve_commit";
  s=await engine.choose(s,"resolve_now");
  s.story.sceneId="m09-eliminated-route";s.story.nodeId="commit";
  s=await engine.choose(s,"commit_now");
  assert.equal(s.world.flags.m12_unlocked,true);
  assert.equal(s.world.flags.m9_complete,true);
  assert.equal(s.world.flags.m9_eliminated_route_complete,true);
  assert.equal(s.world.flags.m10_unlocked,undefined);
  assert.equal(s.world.flags.world_group_advanced,false);
});

test("M9 Cycle 2 save/reload preserves Top16, tiebreak result and eliminated handoff",async()=>{
  let dir;
  try{
    dir=await mkdtemp(path.join(os.tmpdir(),"m9c2-"));
    const {engine}=await makeEngine();
    let s=await throughMd3(engine,["lose","lose","lose"]);
    s.story.sceneId="m09-group-resolution";s.story.nodeId="resolve_commit";
    s=await engine.choose(s,"resolve_now");
    s.story.sceneId="m09-eliminated-route";s.story.nodeId="commit";
    s=await engine.choose(s,"commit_now");
    const store=new SaveStore(dir);
    await store.save(s);
    const loaded=await store.load("slot-m9-cycle2");
    assert.deepEqual(loaded.competition.world.top16,s.competition.world.top16);
    assert.deepEqual(loaded.competition.world.groupStage.allGroupStandings,s.competition.world.groupStage.allGroupStandings);
    assert.equal(loaded.competition.world.groupStage.finalPosition,4);
    assert.equal(loaded.world.flags.m12_unlocked,true);
    assert.equal(loaded.world.flags.m9_complete,true);
  }finally{
    if(dir)await rm(dir,{recursive:true,force:true});
  }
});
